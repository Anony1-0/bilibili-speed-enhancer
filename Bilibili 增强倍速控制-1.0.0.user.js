// ==UserScript==
// @name         Bilibili 增强倍速控制
// @namespace    https://github.com/bilibili-speed-enhancer
// @version      1.0.0
// @description  为B站视频播放器添加0.25x、3.0x、4.0x、5.0x、6.0x、10.0x倍速选项
// @author       Anony1
// @match        https://www.bilibili.com/video/*
// @match        https://www.bilibili.com/bangumi/play/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
//注：本脚本完全由claude4.6 sonnet生成

(function () {
    'use strict';

    // 插入到顶部（2.0x上方），从大到小排列
    const TOP_RATES = [10.0, 6.0, 5.0, 4.0, 3.0];
    // 插入到底部（0.5x下方）
    const BOTTOM_RATES = [0.25];

    const MENU_SELECTOR = '.bpx-player-ctrl-playbackrate-menu';
    const MENU_ITEM_SELECTOR = '.bpx-player-ctrl-playbackrate-menu-item';
    const ACTIVE_CLASS = 'bpx-player-ctrl-playbackrate-menu-item-active';
    const INJECTED_ATTR = 'data-custom-injected';

    let observer = null;
    let retryTimer = null;

    function getVideoElement() {
        return document.querySelector('video.bpx-player-video-perch') ||
            document.querySelector('.bpx-player-video-wrap video') ||
            document.querySelector('video');
    }

    function updateSpeedDisplay(rate) {
        const displayEl = document.querySelector('.bpx-player-ctrl-playbackrate-tip');
        if (displayEl) {
            displayEl.textContent = rate + 'x';
        }

        // 更新所有菜单项的active状态（原生 + 自定义）
        const allItems = document.querySelectorAll(MENU_ITEM_SELECTOR + ', [' + INJECTED_ATTR + ']');
        allItems.forEach(item => {
            item.classList.remove(ACTIVE_CLASS);
            if (parseFloat(item.dataset.value) === rate) {
                item.classList.add(ACTIVE_CLASS);
            }
        });
    }

    function formatRate(rate) {
        // 整数显示为 "3.0x"，小数显示为 "0.25x"
        return Number.isInteger(rate) ? rate.toFixed(1) + 'x' : rate + 'x';
    }

    function createRateItem(rate, templateItem) {
        const li = document.createElement('li');
        li.className = templateItem.className;
        li.classList.remove(ACTIVE_CLASS);
        li.setAttribute(INJECTED_ATTR, 'true');
        li.dataset.value = rate;
        li.textContent = formatRate(rate);

        li.addEventListener('click', function (e) {
            e.stopPropagation();
            const video = getVideoElement();
            if (video) {
                video.playbackRate = rate;
                updateSpeedDisplay(rate);
            }

            // 触发菜单关闭（模拟点击菜单外部或切换display）
            const menu = document.querySelector(MENU_SELECTOR);
            if (menu) {
                menu.style.display = 'none';
                setTimeout(() => { menu.style.display = ''; }, 50);
            }
        });

        return li;
    }

    function injectSpeedOptions() {
        const menu = document.querySelector(MENU_SELECTOR);
        if (!menu) return false;

        // 已注入则跳过
        if (menu.querySelector('[' + INJECTED_ATTR + ']')) return true;

        const existingItems = menu.querySelectorAll(MENU_ITEM_SELECTOR);
        if (existingItems.length === 0) return false;

        const firstItem = existingItems[0];  // 最快那项（2.0x），作为顶部插入参考
        const lastItem = existingItems[existingItems.length - 1]; // 最慢那项（0.5x）

        // 1. 在 2.0x 之前，从大到小依次插入 10x → 6x → 5x → 4x → 3x
        TOP_RATES.forEach(rate => {
            const li = createRateItem(rate, firstItem);
            menu.insertBefore(li, firstItem);
        });

        // 2. 在列表末尾追加 0.25x
        BOTTOM_RATES.forEach(rate => {
            const li = createRateItem(rate, lastItem);
            menu.appendChild(li);
        });

        console.log('[B站增强倍速] 注入完成 ↑顶部:', TOP_RATES, '↓底部:', BOTTOM_RATES);

        // 原生按钮点击时，取消自定义按钮高亮
        existingItems.forEach(item => {
            item.addEventListener('click', function () {
                document.querySelectorAll('[' + INJECTED_ATTR + ']')
                    .forEach(ci => ci.classList.remove(ACTIVE_CLASS));
            });
        });

        return true;
    }

    function setupVideoRateSync() {
        const video = getVideoElement();
        if (!video) return;
        video.addEventListener('ratechange', function () {
            const allCustomRates = [...TOP_RATES, ...BOTTOM_RATES];
            if (allCustomRates.includes(video.playbackRate)) {
                updateSpeedDisplay(video.playbackRate);
            }
        });
    }

    function init() {
        if (retryTimer) { clearInterval(retryTimer); retryTimer = null; }

        let attempts = 0;
        const maxAttempts = 30;

        retryTimer = setInterval(() => {
            attempts++;
            const success = injectSpeedOptions();
            if (success) {
                clearInterval(retryTimer);
                retryTimer = null;
                setupVideoRateSync();
            } else if (attempts >= maxAttempts) {
                clearInterval(retryTimer);
                retryTimer = null;
                console.warn('[B站增强倍速] 超过最大重试次数');
            }
        }, 500);
    }

    function setupMutationObserver() {
        if (observer) observer.disconnect();

        observer = new MutationObserver(function (mutations) {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if ((node.classList && node.classList.contains('bpx-player-ctrl-playbackrate')) ||
                                (node.querySelector && node.querySelector(MENU_SELECTOR))) {
                                setTimeout(init, 300);
                                return;
                            }
                        }
                    }
                }
            }
        });

        const playerContainer = document.querySelector('#bilibili-player') ||
            document.querySelector('.bpx-player-container') ||
            document.body;

        observer.observe(playerContainer, { childList: true, subtree: true });
    }

    // SPA 路由切换检测
    let lastUrl = location.href;
    new MutationObserver(function () {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            console.log('[B站增强倍速] 页面切换，重新初始化...');
            setTimeout(init, 1500);
        }
    }).observe(document.body, { childList: true, subtree: true });

    // 启动
    const startDelay = document.readyState === 'loading' ? 0 : 1000;
    setTimeout(() => {
        init();
        setupMutationObserver();
    }, startDelay === 0 ? (document.addEventListener('DOMContentLoaded', () => setTimeout(() => { init(); setupMutationObserver(); }, 1000)), 99999) : startDelay);

    // 兜底直接启动
    if (document.readyState !== 'loading') {
        setTimeout(() => { init(); setupMutationObserver(); }, 1000);
    }

})();