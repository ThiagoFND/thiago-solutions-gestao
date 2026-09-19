import { AvailabilityMode, ProductOrigin, SupplyMode } from '../common/enums.js';
export function supplyOf(product: { supplyMode?: SupplyMode; availabilityMode?: AvailabilityMode; origin?: ProductOrigin }): SupplyMode {
  return product.supplyMode ?? (product.availabilityMode === AvailabilityMode.MADE_TO_ORDER
    ? product.origin === ProductOrigin.PURCHASED_FOR_RESALE ? SupplyMode.COMPRADO_SOB_DEMANDA : SupplyMode.PRODUZIDO_SOB_DEMANDA
    : SupplyMode.CONTROLADO_POR_ESTOQUE);
}
export function publicAvailability(companyActive: boolean, pagePublished: boolean, category: { active: boolean; published: boolean; archived?: boolean } | undefined, product: { active: boolean; published?: boolean; manuallyHidden?: boolean; availableStock: number; supplyMode?: SupplyMode; availabilityMode?: AvailabilityMode; origin?: ProductOrigin }, hideUnavailable = false) {
  const onDemand = supplyOf(product) !== SupplyMode.CONTROLADO_POR_ESTOQUE;
  const eligible = !!(companyActive && pagePublished && category?.active && category.published && !category.archived && product.active && product.published && !product.manuallyHidden);
  const available = eligible && (onDemand || product.availableStock > 0);
  return { visible: eligible && (!hideUnavailable || available), available, onDemand };
}
