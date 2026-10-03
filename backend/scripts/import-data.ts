import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import {
  inferReferenceDate,
  processAppointments,
  type Doctor,
  type RawAppointmentRow,
} from '../src/modules/imports/process.js';

const DATA_DIR = resolve(process.env.DATA_DIR ?? '../data');
const REPORT_DIR = resolve(process.env.REPORT_DIR ?? 'reports');

function main(): void {
  const csv = readFileSync(resolve(DATA_DIR, 'agendamentos.csv'), 'utf-8');
  const rows = parse(csv, { columns: true, skip_empty_lines: true }) as RawAppointmentRow[];
  const doctors = JSON.parse(readFileSync(resolve(DATA_DIR, 'medicos.json'), 'utf-8')) as Doctor[];

  const referenceDate = inferReferenceDate(rows);
  if (!referenceDate) throw new Error('Nenhuma data de agendamento válida no CSV');

  const { appointments, report } = processAppointments(rows, doctors, referenceDate);

  mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = resolve(REPORT_DIR, 'import-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const sum = (counts: Record<string, number | undefined>) =>
    Object.values(counts).reduce<number>((total, n) => total + (n ?? 0), 0);

  console.log('Importação concluída');
  console.log(`  Data de referência (último agendamento): ${referenceDate.toLocaleString('pt-BR')}`);
  console.log(`  Linhas no CSV:   ${report.totalRows}`);
  console.log(`  Importadas:      ${report.imported}`);
  console.log(`  Descartadas:     ${sum(report.discarded)}`, report.discarded);
  console.log('  Correções:', report.corrected);
  console.log('  Avisos:', report.warnings);
  console.log(`  Médicos:         ${doctors.length}`);
  console.log(`  Consultas prontas para salvar: ${appointments.length}`);
  console.log(`  Relatório completo: ${reportPath}`);
}

main();