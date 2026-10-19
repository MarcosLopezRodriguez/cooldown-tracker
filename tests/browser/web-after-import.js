async(page,config)=>{
 const passed=[]; const check=(ok,message)=>{if(!ok)throw Error(message);};const I='cooldown_site_timers_v1',S='cooldown_settings_v1';const backup=config.upload;
  await page.getByRole('heading',{name:'Revisar importación'}).waitFor();
  check(await page.getByRole('button',{name:'Cancelar',exact:true}).evaluate(el=>el===document.activeElement),'Foco inicial de importación');
  await page.keyboard.press('Escape');await page.getByRole('heading',{name:'Configuración',exact:true}).waitFor();
  await page.keyboard.press('Escape');
  check(await page.getByRole('button',{name:'Abrir configuración'}).evaluate(el=>el===document.activeElement),'No retornó al activador');passed.push('importar, cancelar y retornar al activador solo con teclado');
  await page.getByRole('button',{name:'Abrir configuración'}).click();
  const input=page.locator('input[type=file]');
  await input.setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{')});
  await page.getByRole('alert').filter({hasText:'El archivo no contiene JSON válido.'}).waitFor();passed.push('anuncio de importación inválida');
  await input.setInputFiles(backup);await page.getByRole('heading',{name:'Revisar importación'}).waitFor();
  await page.getByRole('button',{name:'Confirmar importación'}).click();await page.getByRole('heading',{name:'Web editada',exact:true}).waitFor();passed.push('restaurar copia');
  await page.getByRole('button',{name:'Nuevo sitio',exact:true}).click();
  await page.getByRole('textbox',{name:'URL del sitio'}).fill('http://example.com:8080/other');
  await page.getByRole('button',{name:'Añadir sitio',exact:true}).click();
  await page.getByText('Ya existe una regla con ese ámbito. Edita la regla existente.').waitFor();
  await page.keyboard.press('Escape');passed.push('duplicados semánticos rechazados al añadir');
  await page.evaluate(({I,S})=>{localStorage.setItem(I,'{original-roto');localStorage.setItem(S,JSON.stringify({language:'es'}));},{I,S});
  await page.reload();await page.getByText(/No se pueden leer los datos guardados/).waitFor();
  check(await page.evaluate(I=>localStorage.getItem(I),I)==='{original-roto','JSON corrupto sobrescrito');
  const recovery=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar originales para recuperar'}).click();await(await recovery).saveAs(config.output+'/web-recovery.json');passed.push('JSON corrupto protegido y exportable');
  await page.evaluate(({I,S})=>{localStorage.setItem(I,'[]');localStorage.setItem(S,JSON.stringify({language:'es'}));},{I,S});
  await page.getByRole('button',{name:'Reintentar',exact:true}).click();await page.getByRole('heading',{name:'Aún no hay sitios'}).waitFor();passed.push('recuperación tras reintentar');
  const blocked=await page.context().newPage();
  await blocked.addInitScript(()=>Object.defineProperty(window,'localStorage',{get(){throw new DOMException('blocked','SecurityError');}}));
  await blocked.goto(config.baseUrl);await blocked.getByText(/No se pueden leer los datos guardados/).waitFor();await blocked.close();passed.push('almacenamiento bloqueado sin impedir abrir');
  return {passed};
}
