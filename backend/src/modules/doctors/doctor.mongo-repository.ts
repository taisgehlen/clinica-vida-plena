import { DoctorModel, type DoctorDocument } from './doctor.model.js';
import type { Doctor, DoctorRepository } from './doctor.types.js';

const toDoctor = (d: DoctorDocument): Doctor => ({
  id: d._id,
  name: d.name,
  specialty: d.specialty,
  schedule: d.schedule.map((b) => ({ dia: b.dia, inicio: b.inicio, fim: b.fim })),
});

export class MongoDoctorRepository implements DoctorRepository {
  async findAll(): Promise<Doctor[]> {
    const docs = await DoctorModel.find().sort({ _id: 1 }).lean();
    return docs.map(toDoctor);
  }

  async findById(id: string): Promise<Doctor | null> {
    const doc = await DoctorModel.findById(id).lean();
    return doc ? toDoctor(doc) : null;
  }
}