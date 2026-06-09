import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { StatisticsService } from '../services/statisticsService';

export const getOverallStatistics = async (req: Request, res: Response) => {
  try {
    const stats = await StatisticsService.getOverallStatistics();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取总体统计数据失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
};

export const getCourtStatistics = async (req: Request, res: Response) => {
  try {
    const { courtId } = req.params;
    const stats = await StatisticsService.getCourtStatistics(
      new mongoose.Types.ObjectId(courtId)
    );
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取法庭统计数据失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
};

export const getCaseTypeDistribution = async (req: Request, res: Response) => {
  try {
    const { courtId } = req.query;
    const distribution = await StatisticsService.getCaseTypeDistribution(
      courtId ? new mongoose.Types.ObjectId(courtId as string) : undefined
    );
    res.json({
      success: true,
      data: distribution
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取案由分布数据失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
};

export const getComplexityDistribution = async (req: Request, res: Response) => {
  try {
    const { courtId } = req.query;
    const distribution = await StatisticsService.getComplexityDistribution(
      courtId ? new mongoose.Types.ObjectId(courtId as string) : undefined
    );
    res.json({
      success: true,
      data: distribution
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取繁简分流数据失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
};

export const getTrialDurationTrend = async (req: Request, res: Response) => {
  try {
    const { months = 6 } = req.query;
    const trend = await StatisticsService.getTrialDurationTrend(Number(months));
    res.json({
      success: true,
      data: trend
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取审理时长趋势失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
};
