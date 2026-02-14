/**
 * Calculator Logic ported from GAS
 * 
 * Replicates the logic found in `../v3/Calculator.js`
 */

import { Project } from '@/types/database';

// Configuration constants from Config.js
export const TAX_RATE = 0.1;

export interface CalculationResult {
    currentPrice: number | null;
    progress: number;
    isUnformed: boolean;
}

export interface TaxResult {
    taxAmount: number;
    amountInclusive: number;
    taxRate: number;
}

/**
 * Helper to convert value to number safely
 */
function toNumber(value: unknown): number {
    if (value === null || value === undefined || value === '') return 0;
    const num = Number(value);
    return isNaN(num) ? 0 : num;
}

/**
 * Calculate the current unit price based on total area.
 */
export function calculateCurrentUnitPrice(
    campaign: Project,
    totalArea10r: number
): CalculationResult {
    const targetArea = toNumber(campaign.target_area_10r) || 1;
    const basePrice = toNumber(campaign.base_price);
    const minPrice = toNumber(campaign.min_price);
    const minTargetArea = toNumber(campaign.min_target_area_10r);
    const maxTargetArea = toNumber(campaign.max_target_area_10r) || targetArea;
    const executionPrice = toNumber(campaign.execution_price);

    let progress = Math.min(totalArea10r / targetArea, 1);
    let currentPrice: number | null = null;
    let isUnformed = false;

    if (minTargetArea > 0) {
        if (totalArea10r < minTargetArea) {
            progress = totalArea10r / minTargetArea;
            currentPrice = null;
            isUnformed = true;
        } else if (totalArea10r >= maxTargetArea) {
            progress = 1;
            currentPrice = Math.floor(minPrice);
        } else {
            progress = minTargetArea < maxTargetArea
                ? (totalArea10r - minTargetArea) / (maxTargetArea - minTargetArea)
                : 1;
            const execP = executionPrice > 0 ? executionPrice : basePrice;
            currentPrice = Math.floor(execP + (minPrice - execP) * progress);
        }
    } else {
        // Old logic: linear from base -> min
        currentPrice = Math.floor(basePrice - (basePrice - minPrice) * progress);
    }

    return { currentPrice, progress, isUnformed };
}

/**
 * Calculate final amount (excluding tax).
 */
export function calculateFinalAmount(unitPrice: number, actualArea10r: number): number {
    const price = Number(unitPrice) || 0;
    const area = Number(actualArea10r) || 0;
    return Math.floor(area * price);
}

/**
 * Calculate tax and inclusive amount.
 */
export function calculateTax(amountExTax: number): TaxResult {
    const rate = TAX_RATE;
    const amount = Number(amountExTax) || 0;
    const taxAmount = Math.floor(amount * rate);
    const amountInclusive = amount + taxAmount;
    return { taxAmount, amountInclusive, taxRate: rate };
}

/**
 * Calculate polygon area in square meters using spherical approximation.
 * Replicates `calculatePolygonArea` from `js_polygon_map.html`.
 */
export function calculatePolygonArea(latlngs: { lat: number; lng: number }[]): number {
    if (!latlngs || latlngs.length < 3) return 0;

    const R = 6371000; // Earth radius in meters
    let sphericalArea = 0;

    for (let i = 0; i < latlngs.length; i++) {
        const j = (i + 1) % latlngs.length;
        const lat1 = latlngs[i].lat * Math.PI / 180;
        const lng1 = latlngs[i].lng * Math.PI / 180;
        const lat2 = latlngs[j].lat * Math.PI / 180;
        const lng2 = latlngs[j].lng * Math.PI / 180;

        sphericalArea += (lng2 - lng1) * (2 + Math.sin(lat1) + Math.sin(lat2));
    }

    return Math.abs(sphericalArea * R * R / 2);
}
