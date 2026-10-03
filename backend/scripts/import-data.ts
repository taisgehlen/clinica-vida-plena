import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import { connectDatabase, disconnectDatabase } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { AppointmentModel } from '../src/modules/appointments/appointment.model.js';
import { DoctorModel } from '../src/modules/doctors/doctor.model.js';
import {
  inferReferenceDate,
  processAppointments,
  type Doctor,
  type RawAppointmentRow,
} from '../src/modules/imports/process.js';

const DATA_DIR = resolve(process.env.DATA_DIR ?? '../data');
const REPORT_DIR = resolve(process.env.REPORT_DIR ?? 'reports');
const ONLY_IF_EMPTY = process.argv.includes('--if-empty');

async function main(): Promise<void> {
  await connectDatabase(env.mongoUrl);
  try {
    if (ONLY_IF_EMPTY && (await AppointmentModel.estimatedDocumentCount()) > 0) {
      console.log('Banco já tem consultas; importação ignorada (--if-empty).');
      return;
    }

    const csv = readFileSync(resolve(DATA_DIR, 'agendamentos.csv'), 'utf-8');
    const rows = parse(csv, { columns: true, skip_empty_lines: true }) as RawAppointmentRow[];
    const doctors = JSON.parse(readFileSync(resolve(DATA_DIR, 'medicos.json'), 'utf-8')) as Doctor[];

    const referenceDate = inferReferenceDate(rows);
    if (!referenceDate) throw new Error('Nenhuma data de agendamento válida no CSV');

    const { appointments, report } = processAppointments(rows, doctors, referenceDate);

    await DoctorModel.deleteMany({});
    await DoctorModel.insertMany(
      doctors.map((d) => ({ _id: d.id, name: d.nome, specialty: d.especialidade, schedule: d.grade })),
    );
    await AppointmentModel.deleteMany({});
    await AppointmentModel.insertMany(appointments);

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
    console.log(`  Médicos salvos:  ${doctors.length}`);
    console.log(`  Consultas salvas: ${appointments.length}`);
    console.log(`  Relatório completo: ${reportPath}`);
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error('Falha na importação:', err);
  process.exit(1);
});