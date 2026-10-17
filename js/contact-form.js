/*
 * The contact form: visible labels, clear validation, and a delivery state only after the server confirms it
 * (DESIGN.md, Contact). The form posts JSON to its data-endpoint; while no endpoint is configured it says plainly that
 * nothing was sent. On a confirmed send it fires `contact:delivered`, and the mailbox scene settles the envelope into the box.
 */
(function () {
  'use strict';

  var form = document.getElementById('contact-form');
  if (!form) return;
  var status = document.getElementById('form-status');
  var button = form.querySelector('[type="submit"]');

  // ?topic=Our%20games (the Arcade's "get word" link) picks that topic in advance.
  var asked = new URLSearchParams(location.search).get('topic');
  if (asked) {
    var radios = form.querySelectorAll('[name="topic"]');
    for (var r = 0; r < radios.length; r++) if (radios[r].value === asked) radios[r].checked = true;
  }

  var checks = [
    {el: form.elements.name, error: 'cf-name-error', ok: function (v) { return v.trim().length > 0; }},
    {el: form.elements.email, error: 'cf-email-error', ok: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()); }},
    {el: form.querySelector('[name="topic"]'), error: 'cf-topic-error', ok: function () { return !!form.querySelector('[name="topic"]:checked'); }},
    {el: form.elements.message, error: 'cf-message-error', ok: function (v) { return v.trim().length > 0; }}
  ];

  function show(check, bad) {
    var msg = document.getElementById(check.error);
    msg.hidden = !bad;
    var inputs = check.el.type === 'radio' ? form.querySelectorAll('[name="topic"]') : [check.el];
    Array.prototype.forEach.call(inputs, function (input) {
      if (bad) { input.setAttribute('aria-invalid', 'true'); input.setAttribute('aria-describedby', check.error); }
      else { input.removeAttribute('aria-invalid'); input.removeAttribute('aria-describedby'); }
    });
  }

  function validate(focusFirst) {
    var first = null;
    checks.forEach(function (c) {
      var bad = !c.ok(c.el.value || '');
      show(c, bad);
      if (bad && !first) first = c.el;
    });
    if (first && focusFirst) first.focus();
    return !first;
  }

  // Re-check a field as soon as the visitor fixes it, never before they have tried to send.
  var tried = false;
  form.addEventListener('input', function () { if (tried) validate(false); });
  form.addEventListener('change', function () { if (tried) validate(false); });

  function say(text, kind) {
    status.textContent = text;
    status.className = 'form-status' + (kind ? ' form-status--' + kind : '');
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    tried = true;
    if (!validate(true)) { say('Please check the highlighted fields.', 'error'); return; }
    var endpoint = form.getAttribute('data-endpoint');
    if (!endpoint) {
      say('This form isn’t connected to an inbox yet, so your message was not sent.', 'error');
      return;
    }
    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = v; });
    button.disabled = true;
    say('Sending…');
    fetch(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json', Accept: 'application/json'}, body: JSON.stringify(data)})
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        say('Thanks — your message is in. We’ll reply to ' + data.email + '.', 'ok');
        form.reset();
        tried = false;
        document.dispatchEvent(new CustomEvent('contact:delivered'));
      })
      .catch(function () {
        say('Your message couldn’t be sent. Please try again in a moment.', 'error');
      })
      .then(function () { button.disabled = false; });
  });
})();
