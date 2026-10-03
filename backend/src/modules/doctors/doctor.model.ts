import { Schema, model } from 'mongoose';
import type { ScheduleBlock } from '../appointments/rules/slots.js';

export type DoctorDocument = {
  _id: string;
  name: string;
  specialty: string;
  schedule: ScheduleBlock[];
};

const scheduleBlockSchema = new Schema<ScheduleBlock>(
  {
    dia: { type: String, required: true },
    inicio: { type: String, required: true },
    fim: { type: String, required: true },
  },
  { _id: false },
);

const doctorSchema = new Schema<DoctorDocument>({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  specialty: { type: String, required: true },
  schedule: { type: [scheduleBlockSchema], required: true },
});

export const DoctorModel = model<DoctorDocument>('Doctor', doctorSchema);