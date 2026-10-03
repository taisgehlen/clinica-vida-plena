
import mongoose from 'mongoose';
 
export async function connectDatabase(url: string): Promise<void> {
  await mongoose.connect(url);
}
 
export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
 
