async function debugSlots() {
  try {
    // Mesmo cenário: Segunda-feira, profissional com horário 08:00-18:00
    const professionalId = '850dc77d-ed91-49b4-80d0-83a67c6f5fda';
    const date = '2026-01-13'; // Terça-feira
    const procedureId = 'fb7a3cc1-c3ba-4f30-9fdb-4f83e7e37ac7'; // Limpeza 60min
    
    console.log('=== TESTANDO BACKEND ===');
    console.log(`Professional: ${professionalId}`);
    console.log(`Data: ${date}`);
    console.log(`Procedure: ${procedureId}`);
    console.log('');
    
    const url = `http://localhost:3000/api/appointments/available-slots/${professionalId}?date=${date}&procedureId=${procedureId}`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    const slots = data.slots;
    console.log(`Total de slots retornados: ${slots.length}`);
    console.log('');
    
    console.log('=== SLOTS DISPONÍVEIS ===');
    slots.filter(s => s.available).forEach(slot => {
      console.log(`✅ ${slot.start} - ${slot.end}`);
    });
    
    console.log('');
    console.log('=== SLOTS INDISPONÍVEIS ===');
    slots.filter(s => !s.available).forEach(slot => {
      console.log(`❌ ${slot.start} - ${slot.end}`);
    });
    
    // Verifica horários específicos
    console.log('');
    console.log('=== VERIFICAÇÕES ESPECÍFICAS ===');
    
    const expectedAvailable = [
      '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00',
      '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'
    ];
    
    const expectedUnavailable = ['11:30', '12:00', '12:30'];
    
    expectedAvailable.forEach(time => {
      const found = slots.find(s => s.start === time);
      if (!found) {
        console.log(`❌ ERRO: ${time} deveria existir mas não foi retornado!`);
      } else if (!found.available) {
        console.log(`⚠️ ERRO: ${time} deveria estar disponível mas está marcado como indisponível!`);
      }
    });
    
    expectedUnavailable.forEach(time => {
      const found = slots.find(s => s.start === time);
      if (found && found.available) {
        console.log(`⚠️ ERRO: ${time} deveria estar indisponível mas está disponível!`);
      }
    });
    
    // Verifica se está parando prematuramente
    const lastSlot = slots[slots.length - 1];
    console.log('');
    console.log(`Último slot retornado: ${lastSlot.start}`);
    console.log(`Expediente vai até: 18:00`);
    console.log(`Último slot possível com 60min: 17:00 (termina às 18:00)`);
    
    if (lastSlot.start !== '17:00') {
      console.log('');
      console.log('❌ BUG CONFIRMADO: Backend está parando prematuramente!');
      console.log(`   Deveria ir até 17:00 mas parou em ${lastSlot.start}`);
    }
    
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

debugSlots();
