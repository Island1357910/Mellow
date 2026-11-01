/* Deliberately ES5: this screen must work even when the app bundle cannot parse. */
(function () {
  // Keep the normal cascade/custom CSS unchanged on modern browsers.
  // Older WebViews need a separate stylesheet with unsupported layers flattened.
  if (!window.CSS || !window.CSS.supports || !window.CSS.supports('color', 'color-mix(in srgb,red,blue)') || !('CSSLayerBlockRule' in window)) {
    var compatibleStyle = document.createElement('link');
    compatibleStyle.rel = 'stylesheet';
    var script = document.currentScript;
    compatibleStyle.href = script && script.src ? script.src.replace(/boot\.js(?:[?#].*)?$/, 'compat.css') : './compat.css';
    document.head.appendChild(compatibleStyle);
  }
  var timer;
  var ready = false;
  var issue = '';
  function show(message) {
    if (ready || !document.getElementById('mellow-startup')) return;
    document.getElementById('mellow-startup-message').textContent = message;
    document.getElementById('mellow-startup-help').style.display = 'block';
    document.getElementById('mellow-startup-diagnostic').textContent = '半糖启动诊断\n' + navigator.userAgent + '\n' + (issue || '启动等待超时');
  }
  window.__mellowStartup = {
    ready: function () { ready = true; clearTimeout(timer); },
    fail: function (message) { issue = String(message || '启动资源加载失败'); show('小手机暂时没能启动'); }
  };
  window.addEventListener('error', function (event) {
    if (event.message) issue = String(event.message);
    else if (event.target && event.target.tagName === 'SCRIPT') issue = '启动脚本加载失败';
    // A legacy engine may reject the modern module before its fallback starts.
  }, true);
  window.addEventListener('unhandledrejection', function (event) {
    var reason = event.reason;
    issue = String(reason && reason.message ? reason.message : reason || '启动请求失败');
  });
  timer = setTimeout(function () { show('启动时间较长，请检查兼容性或重试'); }, 25000);
})();
