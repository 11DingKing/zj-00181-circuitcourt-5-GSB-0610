import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const connectDB = async (): Promise<void> => {
  try {
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/circuitcourt';
    await mongoose.connect(uri);
    console.log('✅ 数据库连接成功');
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  await mongoose.disconnect();
  console.log('✅ 数据库已断开连接');
};
