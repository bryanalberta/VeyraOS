import type {
  DemoProduct,
  DemoSale,
  DemoPaymentMethod,
} from "@/services/demo/demo-types";

// ---------------------------------------------------------------------------
// Tipe & State Model Kasir POS Demo
// ---------------------------------------------------------------------------

export interface PosCartItem {
  productId: string;
  name: string;
  sku: string;
  unit: string;
  unitPrice: number;
  availableStock: number;
  quantity: number;
  itemDiscount: number;
}

export interface PosState {
  cart: PosCartItem[];
  searchQuery: string;
  selectedCategory: string;
  transactionDiscount: number;
  paymentMethod: DemoPaymentMethod;
  cashReceived: number;
  notes: string;
  isSubmitting: boolean;
  errorMessage: string | null;
  completedSale: DemoSale | null;
  isConfirmOpen: boolean;
  activeMobileTab: "CATALOG" | "CART";
}

export type PosAction =
  | { type: "ADD_TO_CART"; product: DemoProduct }
  | { type: "UPDATE_QUANTITY"; productId: string; quantity: number }
  | { type: "REMOVE_ITEM"; productId: string }
  | { type: "SET_ITEM_DISCOUNT"; productId: string; discount: number }
  | { type: "SET_TRANSACTION_DISCOUNT"; discount: number }
  | { type: "SET_PAYMENT_METHOD"; method: DemoPaymentMethod }
  | { type: "SET_CASH_RECEIVED"; amount: number }
  | { type: "SET_NOTES"; notes: string }
  | { type: "SET_SEARCH_QUERY"; query: string }
  | { type: "SET_CATEGORY"; category: string }
  | { type: "CLEAR_CART" }
  | { type: "OPEN_CONFIRM" }
  | { type: "CLOSE_CONFIRM" }
  | { type: "START_SUBMITTING" }
  | { type: "SUBMIT_SUCCESS"; sale: DemoSale }
  | { type: "SUBMIT_FAILURE"; message: string }
  | { type: "RESET_NEW_TRANSACTION" }
  | { type: "SET_MOBILE_TAB"; tab: "CATALOG" | "CART" };

export const initialPosState: PosState = {
  cart: [],
  searchQuery: "",
  selectedCategory: "ALL",
  transactionDiscount: 0,
  paymentMethod: "CASH",
  cashReceived: 0,
  notes: "",
  isSubmitting: false,
  errorMessage: null,
  completedSale: null,
  isConfirmOpen: false,
  activeMobileTab: "CATALOG",
};

/**
 * Reducer deterministik untuk manajemen state keranjang dan UI kasir POS.
 * Menjamin mutasi state murni dan mudah diuji secara unit tanpa efek samping.
 */
export function posReducer(state: PosState, action: PosAction): PosState {
  switch (action.type) {
    case "ADD_TO_CART": {
      const { product } = action;
      // Jangan tambahkan produk yang tidak aktif atau stoknya habis
      if (product.isArchived || product.stockQuantity <= 0) {
        return state;
      }

      const existingIndex = state.cart.findIndex((i) => i.productId === product.id);

      if (existingIndex >= 0) {
        const existing = state.cart[existingIndex];
        // Cegah penambahan melebihi stok yang tersedia
        if (existing.quantity >= product.stockQuantity) {
          return {
            ...state,
            errorMessage: `Stok produk "${product.name}" telah mencapai batas maksimum tersedia (${product.stockQuantity} ${product.unit}).`,
          };
        }

        const nextCart = [...state.cart];
        nextCart[existingIndex] = {
          ...existing,
          availableStock: product.stockQuantity,
          quantity: existing.quantity + 1,
        };

        return {
          ...state,
          cart: nextCart,
          errorMessage: null,
        };
      }

      const newItem: PosCartItem = {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        unitPrice: product.price,
        availableStock: product.stockQuantity,
        quantity: 1,
        itemDiscount: 0,
      };

      return {
        ...state,
        cart: [...state.cart, newItem],
        errorMessage: null,
      };
    }

    case "UPDATE_QUANTITY": {
      const { productId, quantity } = action;
      if (quantity <= 0) {
        return {
          ...state,
          cart: state.cart.filter((i) => i.productId !== productId),
          errorMessage: null,
        };
      }

      const nextCart = state.cart.map((item) => {
        if (item.productId === productId) {
          const clampedQty = Math.min(quantity, item.availableStock);
          const maxDiscount = clampedQty * item.unitPrice;
          const clampedDiscount = Math.min(item.itemDiscount, maxDiscount);

          return {
            ...item,
            quantity: clampedQty,
            itemDiscount: clampedDiscount,
          };
        }
        return item;
      });

      return {
        ...state,
        cart: nextCart,
        errorMessage: null,
      };
    }

    case "REMOVE_ITEM": {
      return {
        ...state,
        cart: state.cart.filter((i) => i.productId !== action.productId),
        errorMessage: null,
      };
    }

    case "SET_ITEM_DISCOUNT": {
      const { productId, discount } = action;
      const nextCart = state.cart.map((item) => {
        if (item.productId === productId) {
          const grossLine = item.quantity * item.unitPrice;
          const safeDiscount = Math.max(
            0,
            Math.min(Math.floor(Number.isFinite(discount) ? discount : 0), grossLine)
          );
          return {
            ...item,
            itemDiscount: safeDiscount,
          };
        }
        return item;
      });

      return {
        ...state,
        cart: nextCart,
        errorMessage: null,
      };
    }

    case "SET_TRANSACTION_DISCOUNT": {
      const rawDiscount = Math.floor(Number.isFinite(action.discount) ? action.discount : 0);
      return {
        ...state,
        transactionDiscount: Math.max(0, rawDiscount),
        errorMessage: null,
      };
    }

    case "SET_PAYMENT_METHOD": {
      return {
        ...state,
        paymentMethod: action.method,
        errorMessage: null,
      };
    }

    case "SET_CASH_RECEIVED": {
      const safeAmount = Math.floor(Number.isFinite(action.amount) ? action.amount : 0);
      return {
        ...state,
        cashReceived: Math.max(0, safeAmount),
        errorMessage: null,
      };
    }

    case "SET_NOTES": {
      return {
        ...state,
        notes: action.notes,
      };
    }

    case "SET_SEARCH_QUERY": {
      return {
        ...state,
        searchQuery: action.query,
      };
    }

    case "SET_CATEGORY": {
      return {
        ...state,
        selectedCategory: action.category,
      };
    }

    case "CLEAR_CART": {
      return {
        ...state,
        cart: [],
        transactionDiscount: 0,
        cashReceived: 0,
        notes: "",
        errorMessage: null,
        isConfirmOpen: false,
      };
    }

    case "OPEN_CONFIRM": {
      if (state.cart.length === 0) return state;
      return {
        ...state,
        isConfirmOpen: true,
        errorMessage: null,
      };
    }

    case "CLOSE_CONFIRM": {
      return {
        ...state,
        isConfirmOpen: false,
      };
    }

    case "START_SUBMITTING": {
      return {
        ...state,
        isSubmitting: true,
        errorMessage: null,
      };
    }

    case "SUBMIT_SUCCESS": {
      return {
        ...state,
        isSubmitting: false,
        isConfirmOpen: false,
        completedSale: action.sale,
        cart: [],
        transactionDiscount: 0,
        cashReceived: 0,
        notes: "",
        errorMessage: null,
      };
    }

    case "SUBMIT_FAILURE": {
      // Pertahankan keranjang saat terjadi kegagalan transaksi
      return {
        ...state,
        isSubmitting: false,
        isConfirmOpen: false,
        errorMessage: action.message,
      };
    }

    case "RESET_NEW_TRANSACTION": {
      return {
        ...state,
        completedSale: null,
        cart: [],
        transactionDiscount: 0,
        cashReceived: 0,
        notes: "",
        errorMessage: null,
        isConfirmOpen: false,
      };
    }

    case "SET_MOBILE_TAB": {
      return {
        ...state,
        activeMobileTab: action.tab,
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Kalkulasi Finansial Keranjang Kasir
// ---------------------------------------------------------------------------

export interface PosCartSummary {
  itemsCount: number;
  grossTotal: number;
  itemDiscountsTotal: number;
  grossSubtotal: number;
  transactionDiscount: number;
  totalAmount: number;
  cashReceived: number;
  cashChange: number;
  cashShortfall: number;
  isCashSufficient: boolean;
  canCheckout: boolean;
}

export function calculateCartSummary(
  cart: PosCartItem[],
  txDiscountInput: number,
  paymentMethod: DemoPaymentMethod,
  cashReceivedInput: number
): PosCartSummary {
  const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const grossTotal = cart.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const itemDiscountsTotal = cart.reduce((sum, item) => sum + item.itemDiscount, 0);
  const grossSubtotal = Math.max(0, grossTotal - itemDiscountsTotal);

  // Batasi diskon transaksi agar tidak melebihi subtotal kotor
  const transactionDiscount = Math.min(Math.max(0, txDiscountInput), grossSubtotal);
  const totalAmount = Math.max(0, grossSubtotal - transactionDiscount);

  let cashReceived = 0;
  let cashChange = 0;
  let cashShortfall = 0;
  let isCashSufficient = true;

  if (paymentMethod === "CASH") {
    cashReceived = Math.max(0, cashReceivedInput);
    if (cashReceived >= totalAmount) {
      cashChange = cashReceived - totalAmount;
      cashShortfall = 0;
      isCashSufficient = true;
    } else {
      cashChange = 0;
      cashShortfall = totalAmount - cashReceived;
      isCashSufficient = false;
    }
  }

  const canCheckout = cart.length > 0 && isCashSufficient && totalAmount >= 0;

  return {
    itemsCount,
    grossTotal,
    itemDiscountsTotal,
    grossSubtotal,
    transactionDiscount,
    totalAmount,
    cashReceived,
    cashChange,
    cashShortfall,
    isCashSufficient,
    canCheckout,
  };
}

/**
 * Menghasilkan opsi tombol cepat uang pas dan pecahan realistis
 */
export function getQuickCashOptions(totalAmount: number): number[] {
  if (totalAmount <= 0) return [0];

  const presets = new Set<number>();
  presets.add(totalAmount); // Uang Pas

  // Pembulatan ke kelipatan 10.000 terdekat ke atas
  const round10k = Math.ceil(totalAmount / 10000) * 10000;
  if (round10k > totalAmount) presets.add(round10k);

  // Pembulatan ke kelipatan 50.000 terdekat ke atas
  const round50k = Math.ceil(totalAmount / 50000) * 50000;
  if (round50k > totalAmount) presets.add(round50k);

  // Pecahan standar Indonesia jika lebih besar dari total tagihan
  const standardDenominations = [50000, 100000, 200000, 500000];
  for (const denom of standardDenominations) {
    if (denom > totalAmount) {
      presets.add(denom);
    }
  }

  return Array.from(presets)
    .sort((a, b) => a - b)
    .slice(0, 4);
}
