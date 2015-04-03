/**
 * @file 无线划动组件
 * @author dongmei
 */

(function ($) {
    /**
     * @author dongmei
     * @constructor
     * @desc 无线划动组件
     * @param {Object} options 配置项
     * @param {string} options.container 划动区域的外层组件
     * @param {string} options.selector 单个item
     * @param {number} options.speed touchend后的划动时间
     * @param {boolean} options.autoplay 是否自动播放
     * @param {number} options.delay 自动播放时的延时
     * @param {string} options.overflow 超出划动边界时的处理方式
     * @param {number} options.threshold 划动阈值，幅度超出后才认为确实要划动
     * @param {boolean} options.useTouchSpeed 是否根据手指速度决定end后的划动速度
     * @param {boolean} options.displayNav 是否展示导航
     * @param {Function} options.onScrollStart touchstart触发的操作
     * @param {Function} options.onScrollEnd touchend触发的操作
     *
     */
    var Scroller = function (options) {
        var me = this;
        me.options = {
            container: null,
            selector: null,
            speed: 200,
            autoplay: false,
            delay: 1000,
            direction: 'x',
            overflow: 'none',
            threshold: 80,
            useTouchSpeed: true,
            displayNav: true,
            onScrollStart: null,
            onScrollEnd: null,
            onTouchEnd: null,
            onDistroy: null
        };
        $.extend(me.options, options);
        me.currentIndex = 0;
        me.$wrapper = $(me.options.container);
        me.direction = me.options.direction;
        me.overflow = me.options.overflow;
        me.$scroller = me.$wrapper.children().first();
        me.$items = me.$scroller.children();
        me.itemCount = me.$items.length;
        me.containerWidth = me.$wrapper.width() || document.body.clientWidth;
        me.itemWidth = me.$items.first().width() || document.body.clientWidth;
        me.threshold = me.options.threshold;
        me._bind('webkitTransitionEnd');
        me._bind('touchstart');
        if (me.options.autoplay) {
            me._initAutoPlay();
        }
        if (me.options.displayNav && me.itemCount > 1) {
            me._createNav();
            me._setNav();
        }
    };
    Scroller.prototype = {
        /**
         * @function handleEvent
         * @desc 实现EventListener接口
         * @param {event} e 事件对象
         */
        handleEvent: function (e) {
            var me = this;
            switch (e.type) {
                case 'touchstart' : me._start(e);break;
                case 'touchmove' : me._move(e);break;
                case 'touchend' : me._end(e);break;
                case 'touchcancel' : break;
                case 'webkitTansitionEnd' : me._transitionEnd(e);break;
            }
        },
        /**
         * @function _bind
         * @desc 事件绑定
         * @param {string} type 事件类型
         * @private
         */
        _bind: function (type) {
            this.$wrapper[0].addEventListener(type, this, false);
        },
        /**
         * @function _unbind
         * @desc 事件解绑
         * @param {string} type 事件类型
         * @private
         */
        _unbind: function (type) {
            this.$wrapper[0].removeEventListener(type, this, false);
        },
        /**
         * @function _start
         * @desc touchstart逻辑操作
         * @param {event} e 事件对象
         * @private
         */
        _start: function (e) {
            var me = this;
            var offsetPos = me.$scroller.offset();
            if (me.options.onScrollStart) {
                me.options.onScrollStart.call(me, e);
            }
            // 处理异常情况
            if (me.itemWidth * me.itemCount <= me.containerWidth) {
                return;
            }
            // 防止滚动的同时触发可能存在的点击事件
            $(e.target).bind('click', me._preventDefault);
            me.startPos = {
                posx: e.changedTouches[0].pageX,
                posy: e.changedTouches[0].pageY,
                startTime: e.timeStamp || Date.now()
            };
            me.startOffset = {
                posx: offsetPos.left,
                posy: offsetPos.top
            };
            me.started = true;
            me.moved = false;
            me._bind('touchmove');
            me._bind('touchend');
            me._bind('touchcancel');

        },
        /**
         * @function _move
         * @desc touchmove逻辑操作
         * @param {event} e 事件对象
         * @private
         */
        _move: function (e) {
            var me = this;
            if (me._checkShouldMove(e)) {
                if (me.interval) {
                    clearInterval(me.interval);
                    me.interval = null;
                }
                if (!me.started) {
                    me._unbind('touchmove');
                    return;
                }
                e.preventDefault();
                me._doMove(e);
                me.moved = true;
            }
        },
        /**
         * @function _doMove
         * @desc move操作
         * @param {event} e 事件对象
         * @private
         */
        _doMove: function (e) {
            var me = this;
            var diff = me._setPosition(e);
            me._transformTo({
                posx: me.startOffset.posx + diff.posx,
                posy: 0
            });
        },
        /**
         * @function _end
         * @desc touchend操作
         * @param {event} e 事件对象
         * @private
         */
        _end: function (e) {
            var me = this;
            if (!me.moved) {
                $(e.target).unbind('click', me._preventDefault);
            } else {
                e.preventDefault();
                var transitionTime = me.options.speed;
                var pageOffset = 0;
                var distance = me._setPosition(e).posx;
                if (Math.abs(distance) > me.threshold && distance < 0) {
                    pageOffset = 1;
                } else if (Math.abs(distance) > me.threshold && distance > 0) {
                    pageOffset = -1;
                } else {
                    pageOffset = 0;
                }
                if (me.options.useTouchSpeed) {
                    // 根据实际划动速度快慢计算合理的时间
                    var currentSpeed = me._getMoveSpeed(e);
                    transitionTime = distance / currentSpeed;
                }
                if (transitionTime < 50) {
                    transitionTime = 50;
                } else if (transitionTime > 400) {
                    transitionTime = 400;
                }
                me.setCurrentIndex(me.currentIndex + pageOffset);
                me._setTransitionTime(transitionTime);
                me._transformTo({
                    posx: me.currentIndex * -me.itemWidth,
                    posy: 0
                });
                if (me.options.onTouchEnd) {
                    me.options.onTouchEnd.call(me, e);
                }
                me._unbind('touchend');
                me._unbind('touchmove');
                me._unbind('touchcancel');
                if (me.options.autoplay) {
                    me._initAutoPlay();
                }
                if (me.options.displayNav) {
                    me._setNav();
                }
            }
        },
        /**
         * @function _transformTo
         * @desc translate到指定的位置
         * @param {Object} pos 终点位置
         * @private
         */
        _transformTo: function (pos) {
            var me = this;
            me.$scroller[0].style['webkitTransform'] = 'translate(' + pos.posx + 'px,' + pos.posy + 'px) translateZ(0)';
        },
        /**
         * @function _setTransitionTime
         * @desc transition持续的时间
         * @param {number} time 持续时间
         * @private
         */
        _setTransitionTime: function (time) {
            var me = this;
            time = (time === undefined) ? 200 : time;
            me.$scroller[0].style['webkitTransitionDuration'] = time + 'ms';
        },
        /**
         * @function _setPosition
         * @desc 计算起始位置diff
         * @param {event} e 事件对象
         * @return {{posx: number, posy: number}}
         * @private
         */
        _setPosition: function (e) {
            var me = this;
            var dir = 'pos' + me.direction;
            var diff = {
                posx: 0,
                posy: 0
            };
            var pos = {
                posx: 0,
                posy: 0
            };
            if (e && e.changedTouches && e.changedTouches[0]) {
                pos = {
                    posx: e.changedTouches[0].pageX,
                    posy: e.changedTouches[0].pageY
                }
            } else if (e && e.posx) {
                // 指定位置
                pos = {
                    posx: e.posx,
                    poxy: e.poxy
                }
            }
            diff[dir] = pos[dir] - me.startPos[dir];
            if ((me.startOffset.posx === 0 && diff[dir] > 0) || (me.startOffset.posx <= -(me.itemCount - 1) * me.itemWidth && diff[dir] < 0)) {
                if (me.overflow) {
                    // 第一个和最后一个的处理
                    switch (me.overflow) {
                        case 'spring':
                                diff[dir] /= 2;
                            break;
                        default:
                            diff[dir] = 0;
                            break;
                    }
                }
            }
            return diff;
        },
        _transitionEnd: function () {
            var me = this;

        },
        /**
         * @function _preventDefault
         * @desc 阻止默认事件
         * @param {event} e 事件对象
         * @private
         */
        _preventDefault: function (e) {
            e.preventDefault();
        },
        /**
         * @function _getMoveSpeed
         * @desc 获取手指实际划动速度
         * @param {event} e 事件对象
         * @return {number}
         * @private
         */
        _getMoveSpeed: function (e) {
            var me = this;
            if (e.changedTouches && e.changedTouches[0]) {
                var currTime = e.timeStamp || Date.now();
                var speed = Math.abs(e.changedTouches[0].pageX - me.startPos['posx']) / (currTime - me.startPos['startTime']);
                return speed;
            } else {
                return 0;
            }
        },
        /**
         * @function _initAutoPlay
         * @desc 设置自动播放
         * @private
         */
        _initAutoPlay: function () {
            var me = this;
            if (me.interval == null) {
                me.interval = setInterval(function(){
                    var current = me.currentIndex;
                    if (current < 0 || current >= me.itemCount - 1) {
                        current = 0;
                    } else {
                        current += 1;
                    }
                    me.moveTo(current);
                }, me.options.delay);
            }
        },
        /**
         * @function _createNav
         * @desc 创建底部导航
         * @private
         */
        _createNav: function () {
            var me = this;
            var navStr = "<ul class='dot-wrapper'>";
            for (var i = 0; i < me.itemCount; i++) {
                navStr += "<li class='dot'></li>";
            }
            navStr += '</ul>';
            me.$wrapper.append(navStr);
        },
        /**
         * @function _setNav
         * @desc 设置导航active状态
         * @private
         */
        _setNav: function () {
            var me = this;
            me.$wrapper.find('.dot').removeClass('active').eq(me.currentIndex).addClass('active');
        },
        /**
         * @function _checkShouldMove
         * @desc 防止垂直方向划动触发水平移动
         * @param e
         * @private
         * @return {boolean}
         */
        _checkShouldMove: function (e) {
            var me = this;
            var distY = Math.abs(e.changedTouches[0].pageY - me.startPos['posy']);
            var distX = Math.abs(e.changedTouches[0].pageX - me.startPos['posx']);
            if (distY >= distX) {
                return false;
            } else {
                return true;
            }
        },
        /**
         * @function setCurrentIndex
         * @desc 设置当前的index
         * @param {number} index 索引
         * @return {number}
         */
        setCurrentIndex: function (index) {
            var me = this;
            index = parseInt(index);
            if (index < 0) {
                index = 0;
            } else if (index > me.itemCount-1) {
                index = me.itemCount - 1;
            }
            me.currentIndex = index;
            return me.currentIndex;
        },
        /**
         * @function moveTo
         * @desc 划动到指定的index，可单独调用
         * @param {number} index 要滚动到的index
         * @param {number} time 划动的时间
         */
        moveTo: function (index, time) {
            var me = this;
            me.setCurrentIndex(index);
            me._setTransitionTime(time);
            me._transformTo({
                posx : me.currentIndex * -me.itemWidth,
                posy : 0
            });
            if (me.options.autoplay) {
                me._initAutoPlay();
            }
            if (me.options.displayNav) {
                me._setNav();
            }
        },
        /**
         * @function destory
         * @desc
         */
        destory: function () {
            var me = this;
            if (me.options.onDestroy) {
                me.options.onDestroy.call(me);
            }
            me._unbind('resize', window);
            me._unbind('webkitTransitionEnd');
            me._unbind('touchstart');
            me._unbind('touchmove');
            me._unbind('touchend');
            me._unbind('touchcancel');
        }
    };
//    $.scroll = Scroller;
    $.fn.scroll = function(){

    }
})(Zepto);
