import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
  CartInput,
  CartLinesDiscountsGenerateRunResult,
  CartLine,
} from '../generated/api';

/**
 * Determines the nearest bulk discount slab for the given quantity.
 * Returns the applicable slab, or undefined if not found.
 */
function getNearestApplicableSlab(
  slabs: Array<{ minQuantity: number; maxQuantity: number; discountPercentage: number }>,
  quantity: number
) {
  for (const slab of slabs) {
    const { minQuantity, maxQuantity } = slab;
    if (quantity >= minQuantity && quantity <= maxQuantity) {
      return slab;
    }
  }
  return undefined; // Explicitly return undefined if slab not found
}

export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  if (!input.cart.lines.length) {
    throw new Error('No cart lines found');
  }

  const hasProductDiscountClass =
    input?.discount?.discountClasses?.includes(DiscountClass.Product);

  if (!hasProductDiscountClass) {
    return { operations: [] };
  }

  let bulkDiscountSlabs: Array<{ minQuantity: number; maxQuantity: number; discountPercentage: number }> = [];
  try {
    const metafieldValue = input.shop.bulk_discounts?.value || '[]'; // Default to empty array string
    bulkDiscountSlabs = JSON.parse(metafieldValue);
    if (!Array.isArray(bulkDiscountSlabs)) {
      throw new Error('Bulk discount data is not an array');
    }
  } catch (err) {
    throw new Error('Invalid bulk discount data in shop metafield');
  }

  type DiscountCandidate = {
    message: string;
    targets: Array<{ cartLine: { id: string } }>;
    value: { percentage: { value: number } };
  };

  const candidates: DiscountCandidate[] = [];

  for (const line of input.cart.lines) {
    // Assume line is of CartLine type or has same structure (fix if not)
    const quantity = (line as CartLine).quantity;
    if (typeof quantity !== 'number' || quantity <= 0) continue;

    const merchandise = line?.merchandise;
    const isBulkDiscountCategory = 
      merchandise?.__typename === 'ProductVariant' &&
      Array.isArray(merchandise?.product?.inCollections) &&
      merchandise.product.inCollections[0]?.isMember === true;

    if (!isBulkDiscountCategory) continue;

    const applicableSlab = getNearestApplicableSlab(bulkDiscountSlabs, quantity);

    if (!applicableSlab) continue; // Skip if no applicable slab found

    candidates.push({
      message: `${applicableSlab.discountPercentage}% OFF BULK DISCOUNT`,
      targets: [{ cartLine: { id: line.id } }],
      value: { percentage: { value: applicableSlab.discountPercentage } },
    });
  }

  const operations = [
    {
      productDiscountsAdd: {
        candidates,
        selectionStrategy: ProductDiscountSelectionStrategy.All,
      },
    },
  ];

  return { operations };
}
