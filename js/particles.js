/* Hubert Blog · 粒子连线动态背景
   轻量 canvas：小方块（立方体感）+ 圆点粒子，近距离连线，随鼠标轻微牵引。
   自动适配深浅色模式；尊重 prefers-reduced-motion；标签页隐藏时暂停。 */
(function () {
  'use strict';

  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  var canvas = document.createElement('canvas');
  canvas.id = 'particle-canvas';
  document.body.insertBefore(canvas, document.body.firstChild);
  var ctx = canvas.getContext('2d');

  var W = 0, H = 0, dpr = 1;
  var particles = [];
  var mouse = { x: -9999, y: -9999 };
  var running = false;
  var raf = 0;

  var LINK = 150;
  var LINK2 = LINK * LINK;

  function isDark() {
    return document.body.classList.contains('darkmode');
  }

  function newParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      size: 1.8 + Math.random() * 2.2,
      square: Math.random() < 0.55,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.008
    };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var count = Math.max(40, Math.min(110, Math.floor((W * H) / 17000)));
    particles = [];
    for (var i = 0; i < count; i++) {
      particles.push(newParticle());
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var c = isDark() ? '147,197,253' : '59,130,246';
    var i, j;

    ctx.lineWidth = 1;
    for (i = 0; i < particles.length; i++) {
      var p = particles[i];

      for (j = i + 1; j < particles.length; j++) {
        var q = particles[j];
        var dx = p.x - q.x;
        var dy = p.y - q.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < LINK2) {
          var a = (1 - d2 / LINK2) * 0.32;
          ctx.strokeStyle = 'rgba(' + c + ',' + a.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.stroke();
        }
      }

      var mdx = p.x - mouse.x;
      var mdy = p.y - mouse.y;
      var md2 = mdx * mdx + mdy * mdy;
      if (md2 < LINK2 * 2.4) {
        var ma = (1 - md2 / (LINK2 * 2.4)) * 0.5;
        ctx.strokeStyle = 'rgba(' + c + ',' + ma.toFixed(3) + ')';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.stroke();
      }
    }

    ctx.fillStyle = 'rgba(' + c + ',0.42)';
    for (i = 0; i < particles.length; i++) {
      var pt = particles[i];
      if (pt.square) {
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size / 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function step() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      if (p.square) {
        p.rot += p.vr;
      }
      if (p.x < -24) p.x = W + 24;
      else if (p.x > W + 24) p.x = -24;
      if (p.y < -24) p.y = H + 24;
      else if (p.y > H + 24) p.y = -24;
    }
    draw();
    if (running) {
      raf = requestAnimationFrame(step);
    }
  }

  function start() {
    if (running || document.hidden) return;
    running = true;
    raf = requestAnimationFrame(step);
  }

  function stop() {
    running = false;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  window.addEventListener('mouseout', function () {
    mouse.x = -9999;
    mouse.y = -9999;
  });
  window.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
    }
  }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      stop();
    } else {
      start();
    }
  });

  resize();
  start();
})();
