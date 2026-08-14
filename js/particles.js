/* Hubert Blog · 粒子连线动态背景（自由运动版）
   每个粒子拥有独立的「游荡」行为：基速度 + 正弦转向 + 随机脉冲加速度，
   并带深度层次（近大远小、近快远慢）、鼠标轻微避让、粒子间近距离排斥，
   让整体呈现像浮游生物 / 星尘一样的自由感，而不是匀速直线漂移。
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
  var mouse = { x: -9999, y: -9999, active: false };
  var running = false;
  var raf = 0;
  var t = 0;

  var LINK = 150;
  var LINK2 = LINK * LINK;
  var MOUSE_R = 130;      // 鼠标避让半径
  var REPEL_R = 26;       // 粒子间排斥半径

  function isDark() {
    return document.body.classList.contains('darkmode');
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  function newParticle() {
    var z = rand(0.55, 1.45); // 深度：越大越近
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      // 基速度：越近越快
      vx: rand(-0.18, 0.18) * z,
      vy: rand(-0.18, 0.18) * z,
      // 游荡参数（独立相位，避免同步）
      phase: rand(0, Math.PI * 2),
      wobble: rand(0.15, 0.6),          // 转向振荡幅度
      wobbleFreq: rand(0.15, 0.5),      // 振荡频率
      pulse: rand(0, Math.PI * 2),
      pulseFreq: rand(0.02, 0.08),      // 脉冲加速度频率
      size: (1.6 + Math.random() * 2.6) * z,
      z: z,
      square: Math.random() < 0.55,
      rot: Math.random() * Math.PI,
      vr: rand(-0.012, 0.012)
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

    var count = Math.max(40, Math.min(120, Math.floor((W * H) / 16000)));
    particles = [];
    for (var i = 0; i < count; i++) {
      particles.push(newParticle());
    }
  }

  function step() {
    t += 0.016;
    var i, j;

    // 物理更新
    for (i = 0; i < particles.length; i++) {
      var p = particles[i];

      // 1) 游荡转向：让速度方向随时间平滑摆动
      var wob = Math.sin(t * p.wobbleFreq + p.phase) * p.wobble;
      var ang = Math.atan2(p.vy, p.vx) + wob * 0.9;
      var spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      var targetSpd = Math.max(0.08, Math.min(0.85, spd + (0.2 - spd) * 0.004)); // 向巡航速度靠拢
      p.vx = Math.cos(ang) * targetSpd;
      p.vy = Math.sin(ang) * targetSpd;

      // 2) 随机脉冲加速度（偶尔的"冲动"，打破匀速感）
      var pulse = Math.sin(t * p.pulseFreq * 6.28 + p.pulse);
      p.vx += pulse * 0.012;
      p.vy += Math.cos(t * p.pulseFreq * 6.28 + p.pulse) * 0.012;

      // 3) 鼠标避让（靠近则被轻轻推开）
      if (mouse.active) {
        var mx = p.x - mouse.x, my = p.y - mouse.y;
        var md2 = mx * mx + my * my;
        if (md2 < MOUSE_R * MOUSE_R && md2 > 0.0001) {
          var md = Math.sqrt(md2);
          var force = (1 - md / MOUSE_R) * 0.6;
          p.vx += (mx / md) * force;
          p.vy += (my / md) * force;
        }
      }

      // 4) 粒子间近距离排斥（避免堆叠）
      for (j = i + 1; j < particles.length; j++) {
        var q = particles[j];
        var dx = p.x - q.x, dy = p.y - q.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < REPEL_R * REPEL_R && d2 > 0.0001) {
          var d = Math.sqrt(d2);
          var f = (1 - d / REPEL_R) * 0.06;
          var nx = dx / d, ny = dy / d;
          p.vx += nx * f; p.vy += ny * f;
          q.vx -= nx * f; q.vy -= ny * f;
        }
      }

      // 速度上限
      var vs = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (vs > 1.1) { p.vx = (p.vx / vs) * 1.1; p.vy = (p.vy / vs) * 1.1; }

      // 积分 + 边界环绕
      p.x += p.vx;
      p.y += p.vy;
      if (p.square) { p.rot += p.vr; }
      if (p.x < -30) p.x = W + 30; else if (p.x > W + 30) p.x = -30;
      if (p.y < -30) p.y = H + 30; else if (p.y > H + 30) p.y = -30;
    }

    // 渲染
    ctx.clearRect(0, 0, W, H);
    var c = isDark() ? '147,197,253' : '59,130,246';

    ctx.lineWidth = 1;
    for (i = 0; i < particles.length; i++) {
      var a = particles[i];
      for (j = i + 1; j < particles.length; j++) {
        var b = particles[j];
        var dx = a.x - b.x, dy = a.y - b.y;
        var d2 = dx * dx + dy * dy;
        if (d2 < LINK2) {
          var alpha = (1 - d2 / LINK2) * 0.34;
          ctx.strokeStyle = 'rgba(' + c + ',' + alpha.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
      if (mouse.active) {
        var mx = a.x - mouse.x, my = a.y - mouse.y;
        var md2 = mx * mx + my * my;
        if (md2 < LINK2 * 2.4) {
          var ma = (1 - md2 / (LINK2 * 2.4)) * 0.5;
          ctx.strokeStyle = 'rgba(' + c + ',' + ma.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.stroke();
        }
      }
    }

    for (i = 0; i < particles.length; i++) {
      var pt = particles[i];
      var alpha = 0.22 + (pt.z - 0.55) * 0.28; // 越近越亮
      ctx.fillStyle = 'rgba(' + c + ',' + alpha.toFixed(3) + ')';
      if (pt.square) {
        ctx.save();
        ctx.translate(pt.x, pt.y);
        ctx.rotate(pt.rot);
        var s = pt.size;
        ctx.fillRect(-s / 2, -s / 2, s, s);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size / 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

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
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', function (e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  });
  window.addEventListener('mouseout', function () {
    mouse.active = false;
    mouse.x = -9999;
    mouse.y = -9999;
  });
  window.addEventListener('touchmove', function (e) {
    if (e.touches && e.touches.length) {
      mouse.x = e.touches[0].clientX;
      mouse.y = e.touches[0].clientY;
      mouse.active = true;
    }
  }, { passive: true });
  window.addEventListener('touchend', function () {
    mouse.active = false;
  });
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { stop(); } else { start(); }
  });

  resize();
  start();
})();
