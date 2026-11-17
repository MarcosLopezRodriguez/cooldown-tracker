async (page, config) => {
  const view = await page.context().newPage();
  const passed = [];
  const check = (ok, text) => { if (!ok) throw Error(text); };
  const start = Date.now();
  await view.clock.install({ time: start });
  await view.addInitScript(() => {
    window.Notification = class {
      static permission = 'granted';
      constructor() { sessionStorage.setItem('noticeCount', String(Number(sessionStorage.getItem('noticeCount') || 0) + 1)); }
      close() {}
    };
  });
  try {
    await view.goto(config.baseUrl);
    const item = { id: 'duration-check', label: 'Duración comprobada', url: 'https://duration.test/', mode: 'cooldown', scope: 'domain', durationMs: 120000, lastVisitedAt: start, endAt: start + 120000, createdAt: start };
    await view.evaluate(item => {
      localStorage.setItem('cooldown_site_timers_v1', JSON.stringify([item]));
      localStorage.setItem('cooldown_settings_v1', JSON.stringify({ language: 'es', soundOn: false, notificationsOn: true }));
      localStorage.removeItem('cooldown_web_completions_v1');
      sessionStorage.setItem('noticeCount', '0');
    }, item);
    await view.reload();
    const edit = async minutes => {
      await view.getByRole('button', { name: 'Editar sitio' }).click();
      await view.getByRole('spinbutton', { name: 'Tiempo de cooldown' }).fill(String(minutes));
      await view.getByRole('button', { name: 'Guardar cambios', exact: true }).click();
      await view.getByRole('heading', { name: 'Aplicar nueva duración' }).waitFor();
    };
    const stored = () => view.evaluate(() => JSON.parse(localStorage.getItem('cooldown_site_timers_v1'))[0]);
    await edit(3);
    await view.getByRole('button', { name: 'Próxima visita', exact: true }).click();
    await view.waitForFunction(() => JSON.parse(localStorage.getItem('cooldown_site_timers_v1'))[0].durationMs === 180000);
    check((await stored()).endAt === item.endAt, 'Próxima visita cambió el contador activo');
    passed.push('próxima visita conserva el vencimiento');
    await edit(1);
    await view.getByRole('button', { name: 'Aplicar ahora', exact: true }).click();
    await view.waitForFunction(endAt => JSON.parse(localStorage.getItem('cooldown_site_timers_v1'))[0].endAt === endAt, start + 60000);
    passed.push('aplicar ahora recalcula desde la última visita');
    const backup = await stored();
    await view.clock.fastForward(61000);
    await view.waitForFunction(() => sessionStorage.getItem('noticeCount') === '1');
    await view.clock.setSystemTime(start);
    await view.evaluate(item => localStorage.setItem('cooldown_site_timers_v1', JSON.stringify([item])), backup);
    await view.reload();
    await view.clock.fastForward(61000);
    await view.waitForFunction(() => JSON.parse(localStorage.getItem('cooldown_site_timers_v1'))[0].endAt === null);
    check(await view.evaluate(() => sessionStorage.getItem('noticeCount')) === '1', 'Se repitió el aviso al restaurar y recargar');
    passed.push('restauración y recarga no repiten avisos web');
    return { passed };
  } finally { await view.close(); }
}
