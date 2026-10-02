export const SLOT_MINUTES = 30;

export type Weekday = 'domingo' | 'segunda' | 'terca' | 'quarta' | 'quinta' | 'sexta' | 'sabado';

export type ScheduleBlock = {
  dia: Weekday;
  inicio: string;
  fim: string;    
};

export type SlotResult =
  | { ok: true }
  | { ok: false; error: string };

const WEEKDAYS: Weekday[] = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours! * 60 + minutes!;
}

export function validateSlot(schedule: ScheduleBlock[], start: Date): SlotResult {
  if (start.getMinutes() % SLOT_MINUTES !== 0 || start.getSeconds() !== 0 || start.getMilliseconds() !== 0) {
    return { ok: false, error: 'Consultas devem começar em horários cheios ou meia hora (ex: 08:00, 08:30)' };
  }

  const weekday = WEEKDAYS[start.getDay()];
  const blocksOfTheDay = schedule.filter((block) => block.dia === weekday);
  if (blocksOfTheDay.length === 0) {
    return { ok: false, error: 'O médico não atende neste dia da semana' };
  }

  const slotStart = start.getHours() * 60 + start.getMinutes();
  const slotEnd = slotStart + SLOT_MINUTES;
  const fits = blocksOfTheDay.some(
    (block) => slotStart >= toMinutes(block.inicio) && slotEnd <= toMinutes(block.fim),
  );
  if (!fits) {
    return { ok: false, error: 'Horário fora da grade de atendimento do médico' };
  }

  return { ok: true };
}