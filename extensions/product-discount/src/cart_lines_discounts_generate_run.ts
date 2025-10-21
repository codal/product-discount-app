import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
  CartInput,
  CartLinesDiscountsGenerateRunResult,
} from '../generated/api';


export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  if (!input.cart.lines.length) {
    throw new Error('No cart lines found');
  }

  const hasProductDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Product,
  );

  if (!hasProductDiscountClass) {
    return { operations: [] };
  }

  const candidates = [];
  const metafieldValue = input.shop.bulk_discounts?.value || '';
  const BulkDiscountJSONFields = JSON.parse(metafieldValue)

  const getNearestApplicableSlab = (quantity: number) => {
    const slabs = BulkDiscountJSONFields;
    for (const slab of slabs) {
      const minQuantity = +slab.minQuantity;
      const maxQuantity = +slab.maxQuantity;
      if (quantity >= minQuantity && quantity <= maxQuantity) {
        return slab;
      }
    }
  }


  for (const line of input.cart.lines) {
    const quantity = +(line as any).quantity as number | undefined;
    if (quantity !== undefined) {
      const applicableDiscountSlab = getNearestApplicableSlab(quantity);
      const discountPercentage = +applicableDiscountSlab.discountPercentage;
      candidates.push({
        message: `${discountPercentage}% OFF PRODUCT`,
        targets: [{ cartLine: { id: line.id } }],
        value: { percentage: { value: discountPercentage } }
      });
    }
  }
  const operations = [{
    productDiscountsAdd: {
      candidates,
      selectionStrategy: ProductDiscountSelectionStrategy.All
    }
  }]

  return { operations };
}