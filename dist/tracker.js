(function () {
  'use strict';
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    var storage = {
      get: function (type, key) {
        try {
          return (type === 'session' ? window.sessionStorage : window.localStorage).getItem(key);
        } catch (e) {
          return null;
        }
      },
      set: function (type, key, val) {
        try {
          (type === 'session' ? window.sessionStorage : window.localStorage).setItem(key, val);
        } catch (e) {}
      }
    };

    if (storage.get('local', 'apthex_ignore') === '1') return;
    if (/bot|googlebot|crawler|spider|robot|crawling/i.test(navigator.userAgent)) return;

    function getUUID() {
      if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });
    }

    var VID_KEY = 'apthex_vid';
    var SID_KEY = 'apthex_sid';
    var vid = storage.get('local', VID_KEY);
    if (!vid) {
      vid = 'v_' + getUUID();
      storage.set('local', VID_KEY, vid);
    }

    var sid = storage.get('session', SID_KEY);
    if (!sid) {
      sid = 's_' + getUUID();
      storage.set('session', SID_KEY, sid);
    }

    var startTime = Date.now();
    var page = window.location.pathname || '/';
    var referrer = document.referrer || '';

    function send(data) {
      try {
        var payload = JSON.stringify(Object.assign({
          visit_id: sid,
          visitor_id: vid,
          page: page,
          referrer: referrer
        }, data));

        var endpoint = 'https://apt-root.apthex.com/api/c';

        if (typeof fetch === 'function') {
          fetch(endpoint, {
            method: 'POST',
            body: payload,
            headers: { 'Content-Type': 'application/json' },
            mode: 'cors',
            keepalive: true
          }).catch(function () {
            if (navigator.sendBeacon) {
              var blob = new Blob([payload], { type: 'text/plain' });
              navigator.sendBeacon(endpoint, blob);
            }
          });
        } else if (navigator.sendBeacon) {
          var blob = new Blob([payload], { type: 'text/plain' });
          navigator.sendBeacon(endpoint, blob);
        }
      } catch (e) {}
    }

    // 1. Initial pageview beacon
    send({ type: 'pageview' });

    // 2. Heartbeat to capture active time on page every 15s
    setInterval(function () {
      var duration = Math.round((Date.now() - startTime) / 1000);
      send({ type: 'heartbeat', duration: duration });
    }, 15000);

    function onLeave() {
      var duration = Math.round((Date.now() - startTime) / 1000);
      send({ type: 'heartbeat', duration: duration });
    }
    window.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') onLeave();
    });
    window.addEventListener('beforeunload', onLeave);

    // 3. Track contact form submissions
    document.addEventListener('submit', function (e) {
      try {
        var target = e.target;
        if (target && (target.id === 'form' || target.classList.contains('modal__form') || target.closest('#form'))) {
          send({ type: 'contact_form_submit' });
        }
      } catch (err) {}
    }, true);

    // 4. Track apply button clicks
    document.addEventListener('click', function (e) {
      try {
        var link = e.target && e.target.closest ? e.target.closest('a.apply') : null;
        if (link) {
          var article = link.closest('article');
          var role = article && article.querySelector('h2') ? article.querySelector('h2').textContent.trim() : '';
          send({ type: 'apply_click', role: role || 'Open Role' });
        }
      } catch (err) {}
    }, true);
  } catch (err) {}
})();
