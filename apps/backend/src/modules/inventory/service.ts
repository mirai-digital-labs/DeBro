import { Warehouse, InventoryLevel, StockReservation } from '@platform/types';

export class InventoryService {
  private warehouses: Map<string, Warehouse> = new Map();
  // Key: `${warehouseId}_${variantId}`
  private inventoryLevels: Map<string, InventoryLevel> = new Map();
  // Key: cartId, Value: list of reservations
  private reservations: Map<string, StockReservation[]> = new Map();

  constructor() {
    this.seedInitialWarehouses();
  }

  private seedInitialWarehouses() {
    // 1. Karachi Central Fulfillment Hub
    this.createWarehouse({
      id: 'wh_khi_01',
      code: 'WH-KHI-01',
      name: 'Karachi Central Fulfillment Hub',
      city: 'Karachi',
      address: 'Plot 14-B, Sector 23, Korangi Industrial Area, Karachi',
      isActive: true,
    });

    // 2. Lahore Regional Hub
    this.createWarehouse({
      id: 'wh_lhe_01',
      code: 'WH-LHE-01',
      name: 'Lahore Regional Logistics Center',
      city: 'Lahore',
      address: '18 KM Multan Road, Industrial Zone, Lahore',
      isActive: true,
    });

    // Seed stock levels for our primary catalog items
    // Tech: Ultrabook Pro 14 (16GB/512GB) -> 14 units in Karachi
    this.setStock('wh_khi_01', 'var_ub14_16_512', 14);
    // Tech: Ultrabook Pro 14 (32GB/1TB) -> 8 units in Karachi
    this.setStock('wh_khi_01', 'var_ub14_32_1tb', 8);
    // Tech: ThinkBook Workstation -> 5 units in Lahore
    this.setStock('wh_lhe_01', 'var_think_32_1tb', 5);
    // Fashion: Oxford Cotton Shirt White M -> 25 units in Karachi
    this.setStock('wh_khi_01', 'var_oxf_wht_m', 25);
    // Limited flash sale item: 1 item for concurrency stress test
    this.setStock('wh_khi_01', 'var_flash_rare_01', 1);
  }

  // --------------------------------------------------------------------------
  // Warehouse Management
  // --------------------------------------------------------------------------
  public createWarehouse(warehouse: Warehouse): Warehouse {
    this.warehouses.set(warehouse.id, warehouse);
    return warehouse;
  }

  public getWarehouses(): Warehouse[] {
    return Array.from(this.warehouses.values()).filter((w) => w.isActive);
  }

  // --------------------------------------------------------------------------
  // Stock Levels
  // --------------------------------------------------------------------------
  public setStock(warehouseId: string, variantId: string, quantity: number): InventoryLevel {
    const key = `${warehouseId}_${variantId}`;
    const existing = this.inventoryLevels.get(key);
    const reserved = existing ? existing.reservedQuantity : 0;

    const level: InventoryLevel = {
      id: `inv_${warehouseId}_${variantId}`,
      warehouseId,
      variantId,
      stockedQuantity: Math.max(0, quantity),
      reservedQuantity: reserved,
      availableQuantity: Math.max(0, quantity - reserved),
    };

    this.inventoryLevels.set(key, level);
    return level;
  }

  public getAvailableStock(variantId: string): number {
    this.cleanupExpiredReservations();

    let totalAvailable = 0;
    for (const level of this.inventoryLevels.values()) {
      if (level.variantId === variantId) {
        totalAvailable += Math.max(0, level.stockedQuantity - level.reservedQuantity);
      }
    }
    return totalAvailable;
  }

  public getStockBreakdown(variantId: string): InventoryLevel[] {
    this.cleanupExpiredReservations();
    return Array.from(this.inventoryLevels.values()).filter((l) => l.variantId === variantId);
  }

  // --------------------------------------------------------------------------
  // Concurrency-Safe Stock Reservation (Two-Phase Commit)
  // --------------------------------------------------------------------------
  /**
   * Phase 1: Temporary hold during checkout. Concurrency-safe reservation.
   * If available stock is insufficient, throws immediate error to prevent overselling.
   */
  public reserveStock(
    cartId: string,
    variantId: string,
    quantity: number,
    ttlMinutes: number = 15
  ): StockReservation {
    this.cleanupExpiredReservations();

    if (quantity <= 0) {
      throw new Error('Reservation quantity must be greater than zero.');
    }

    // Find warehouse with available stock (Karachi first, then Lahore)
    let selectedLevel: InventoryLevel | null = null;
    let selectedKey: string | null = null;

    for (const [key, level] of this.inventoryLevels.entries()) {
      if (level.variantId === variantId) {
        const available = level.stockedQuantity - level.reservedQuantity;
        if (available >= quantity) {
          selectedLevel = level;
          selectedKey = key;
          break;
        }
      }
    }

    if (!selectedLevel || !selectedKey) {
      const totalAvailable = this.getAvailableStock(variantId);
      const error: any = new Error(
        `Overselling prevented: Insufficient available inventory for variant '${variantId}'. Requested: ${quantity}, Available: ${totalAvailable}.`
      );
      error.status = 400;
      throw error;
    }

    // Atomically increment reserved quantity
    selectedLevel.reservedQuantity += quantity;
    selectedLevel.availableQuantity = selectedLevel.stockedQuantity - selectedLevel.reservedQuantity;
    this.inventoryLevels.set(selectedKey, selectedLevel);

    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
    const reservation: StockReservation = {
      id: `res_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      variantId,
      warehouseId: selectedLevel.warehouseId,
      cartId,
      quantity,
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    const cartReservations = this.reservations.get(cartId) || [];
    cartReservations.push(reservation);
    this.reservations.set(cartId, cartReservations);

    return reservation;
  }

  /**
   * Phase 2: Commit stock on order placement / payment confirmation.
   * Decrements stockedQuantity and decrements reservedQuantity permanently.
   */
  public commitStock(cartId: string): void {
    const cartReservations = this.reservations.get(cartId);
    if (!cartReservations || cartReservations.length === 0) {
      return; // No pending reservation to commit
    }

    for (const res of cartReservations) {
      const key = `${res.warehouseId}_${res.variantId}`;
      const level = this.inventoryLevels.get(key);
      if (level) {
        level.stockedQuantity = Math.max(0, level.stockedQuantity - res.quantity);
        level.reservedQuantity = Math.max(0, level.reservedQuantity - res.quantity);
        level.availableQuantity = level.stockedQuantity - level.reservedQuantity;
        this.inventoryLevels.set(key, level);
      }
    }

    this.reservations.delete(cartId);
  }

  /**
   * Rollback: Release reservation on checkout cancel or payment failure.
   */
  public releaseReservation(cartId: string): void {
    const cartReservations = this.reservations.get(cartId);
    if (!cartReservations || cartReservations.length === 0) {
      return;
    }

    for (const res of cartReservations) {
      const key = `${res.warehouseId}_${res.variantId}`;
      const level = this.inventoryLevels.get(key);
      if (level) {
        level.reservedQuantity = Math.max(0, level.reservedQuantity - res.quantity);
        level.availableQuantity = level.stockedQuantity - level.reservedQuantity;
        this.inventoryLevels.set(key, level);
      }
    }

    this.reservations.delete(cartId);
  }

  /**
   * Automatic background cleanup for TTL-expired checkout reservations.
   */
  public cleanupExpiredReservations(): number {
    const now = new Date().getTime();
    let releasedCount = 0;

    for (const [cartId, reservations] of this.reservations.entries()) {
      const expired = reservations.filter((r) => new Date(r.expiresAt).getTime() <= now);
      if (expired.length > 0) {
        for (const res of expired) {
          const key = `${res.warehouseId}_${res.variantId}`;
          const level = this.inventoryLevels.get(key);
          if (level) {
            level.reservedQuantity = Math.max(0, level.reservedQuantity - res.quantity);
            level.availableQuantity = level.stockedQuantity - level.reservedQuantity;
            this.inventoryLevels.set(key, level);
            releasedCount += res.quantity;
          }
        }

        const remaining = reservations.filter((r) => new Date(r.expiresAt).getTime() > now);
        if (remaining.length === 0) {
          this.reservations.delete(cartId);
        } else {
          this.reservations.set(cartId, remaining);
        }
      }
    }

    return releasedCount;
  }

  public getAllInventoryLevels(): InventoryLevel[] {
    this.cleanupExpiredReservations();
    return Array.from(this.inventoryLevels.values());
  }

  public getLowStockAlerts(threshold: number = 10): InventoryLevel[] {
    this.cleanupExpiredReservations();
    return Array.from(this.inventoryLevels.values()).filter(
      (l) => l.availableQuantity <= threshold
    );
  }
}

// Singleton Service Instance
export const inventoryService = new InventoryService();
