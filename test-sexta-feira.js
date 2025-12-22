const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testSextaFeira() {
  try {
    console.log('=== TESTE: SEXTA-FEIRA 02/01/2026 ===\n');
    
    // Busca configuração do profissional
    const professional = await prisma.professional.findUnique({
      where: { id: '850dc77d-ed91-49b4-80d0-83a67c6f5fda' }
    });
    
    const scheduleSettings = professional.scheduleSettings;
    console.log('Configuração da semana:');
    console.log(JSON.stringify(scheduleSettings.weeklySchedule, null, 2));
    
    // Sexta-feira é dia 5
    const friday = scheduleSettings.weeklySchedule.find(d => d.day === 5);
    console.log('\n📅 Sexta-feira (dia 5):');
    console.log(`   Habilitado: ${friday.enabled}`);
    console.log(`   Horário: ${friday.start} - ${friday.end}`);
    console.log(`   Break: ${friday.breakStart} - ${friday.breakEnd}`);
    
    // Calcula slots esperados com procedimento de 60 minutos
    console.log('\n🕐 Com procedimento de 60 minutos:');
    
    const [startH, startM] = friday.start.split(':').map(Number);
    const [endH, endM] = friday.end.split(':').map(Number);
    const [breakStartH, breakStartM] = friday.breakStart.split(':').map(Number);
    const [breakEndH, breakEndM] = friday.breakEnd.split(':').map(Number);
    
    const procedureDuration = 60;
    const slotInterval = 30;
    
    let currentHour = startH;
    let currentMin = startM;
    let validSlots = [];
    let invalidSlots = [];
    
    while (true) {
      const timeStr = `${currentHour.toString().padStart(2, '0')}:${currentMin.toString().padStart(2, '0')}`;
      
      // Calcula quando termina
      const totalMinutes = currentHour * 60 + currentMin + procedureDuration;
      const endHourCalc = Math.floor(totalMinutes / 60);
      const endMinCalc = totalMinutes % 60;
      const endTimeStr = `${endHourCalc.toString().padStart(2, '0')}:${endMinCalc.toString().padStart(2, '0')}`;
      
      // Para se começar após fim do expediente
      if (currentHour > endH || (currentHour === endH && currentMin >= endM)) {
        break;
      }
      
      // Para se terminar após fim do expediente
      if (endHourCalc > endH || (endHourCalc === endH && endMinCalc > endM)) {
        invalidSlots.push(`${timeStr} (terminaria ${endTimeStr}, após ${friday.end})`);
        break;
      }
      
      // Verifica se está durante break
      const duringBreak = (currentHour > breakStartH || (currentHour === breakStartH && currentMin >= breakStartM)) &&
                         (currentHour < breakEndH || (currentHour === breakEndH && currentMin < breakEndM));
      
      // Verifica se invade break
      const invasionBreak = (endHourCalc > breakStartH || (endHourCalc === breakStartH && endMinCalc > breakStartM)) &&
                           (currentHour < breakEndH || (currentHour === breakEndH && currentMin < breakEndM));
      
      if (duringBreak || invasionBreak) {
        invalidSlots.push(`${timeStr} (durante ou invade break)`);
      } else {
        validSlots.push(timeStr);
      }
      
      // Próximo slot
      currentMin += slotInterval;
      if (currentMin >= 60) {
        currentMin -= 60;
        currentHour++;
      }
    }
    
    console.log('\n✅ Slots válidos esperados:', validSlots.length);
    validSlots.forEach(s => console.log(`   ${s}`));
    
    console.log('\n❌ Slots inválidos esperados:', invalidSlots.length);
    invalidSlots.forEach(s => console.log(`   ${s}`));
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSextaFeira();
