import type { ScheduleBlock } from '../appointments/rules/slots.js';

export type Doctor = {
  id: string;
  name: string;
  specialty: string;
  schedule: ScheduleBlock[];
};

export interface DoctorRepository {
  findAll(): Promise<Doctor[]>;
  findById(id: string): Promise<Doctor | null>;
}