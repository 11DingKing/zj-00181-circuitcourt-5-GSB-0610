import { Request, Response } from 'express';
import { JurisdictionService } from '../services/jurisdictionService';
import CircuitCourt from '../models/CircuitCourt';

export const getAllCourts = async (req: Request, res: Response) => {
  try {
    const courts = await JurisdictionService.getAllCourts();
    res.json({
      success: true,
      data: courts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取巡回法庭列表失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
};

export const getCourtByCode = async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    const court = await JurisdictionService.getCourtByCode(code);
    if (!court) {
      return res.status(404).json({
        success: false,
        message: '未找到该巡回法庭'
      });
    }
    res.json({
      success: true,
      data: court
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取巡回法庭信息失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
};

export const getCourtCoverage = async (req: Request, res: Response) => {
  try {
    const coverage = await JurisdictionService.getCourtCoverage();
    res.json({
      success: true,
      data: coverage
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取辖区覆盖信息失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
};

export const matchJurisdiction = async (req: Request, res: Response) => {
  try {
    const { province, city, county } = req.body;
    if (!province || !city || !county) {
      return res.status(400).json({
        success: false,
        message: '请提供完整的地理位置信息（省、市、县）'
      });
    }

    const result = await JurisdictionService.matchCircuitCourt({
      province,
      city,
      county
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: '未找到匹配的巡回法庭'
      });
    }

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '管辖权匹配失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
};

export const createCourt = async (req: Request, res: Response) => {
  try {
    const court = new CircuitCourt(req.body);
    await court.save();
    res.status(201).json({
      success: true,
      data: court
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '创建巡回法庭失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
};

export const updateCourt = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const court = await CircuitCourt.findByIdAndUpdate(id, req.body, { new: true });
    if (!court) {
      return res.status(404).json({
        success: false,
        message: '未找到该巡回法庭'
      });
    }
    res.json({
      success: true,
      data: court
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '更新巡回法庭失败',
      error: error instanceof Error ? error.message : '未知错误'
    });
  }
};
