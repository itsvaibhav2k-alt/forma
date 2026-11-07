import type { LoadCase, NodeId } from './structures';

export type AmountSource =
  | { readonly kind: 'supplier-quote'; readonly label: string }
  | { readonly kind: 'user-estimate'; readonly label: string }
  | { readonly kind: 'demo-assumption'; readonly label: string };

/** Unknown is distinct from a deliberately entered zero. All USD values are real dollars. */
export type AmountInput =
  | { readonly status: 'known'; readonly usd: number; readonly source: AmountSource }
  | { readonly status: 'unknown'; readonly note: string };

export interface QuotePackage {
  readonly id: string;
  readonly label: string;
  readonly scope: string;
  readonly materials: AmountInput;
  readonly freight: AmountInput;
  readonly installation: AmountInput;
  readonly cashContribution: AmountInput;
  readonly annualUpkeep: AmountInput;
  readonly donationNote: string;
}

export interface QuoteInputs {
  readonly packages: readonly [QuotePackage, QuotePackage];
  readonly budgetUsd: number;
  readonly years: number;
  /** Decimal real annual rate: 0.03 means 3%, not 3. */
  readonly realRate: number;
}

export type CostField = 'materials' | 'freight' | 'installation' | 'cashContribution' | 'annualUpkeep';
export interface MissingCostInput {
  readonly packageId: string;
  readonly field: CostField;
}

export type CalculatedAmount =
  | { readonly status: 'known'; readonly usd: number }
  | { readonly status: 'unknown'; readonly missing: readonly MissingCostInput[] };

export interface PackageCosts {
  readonly packageId: string;
  readonly upfront: CalculatedAmount;
  readonly fundingGap: CalculatedAmount;
  readonly presentCost: CalculatedAmount;
}

export type BreakEven =
  | {
      readonly status: 'premium';
      readonly higherUpfrontPackageId: string;
      readonly upfrontPremiumUsd: number;
      readonly requiredAnnualSavingsUsd: number;
      readonly expectedAnnualSavings: CalculatedAmount;
    }
  | { readonly status: 'equal-upfront'; readonly requiredAnnualSavingsUsd: 0 }
  | { readonly status: 'unknown'; readonly missing: readonly MissingCostInput[] };

export interface Costs {
  readonly status: 'ok';
  readonly annuityFactor: number;
  readonly packages: readonly [PackageCosts, PackageCosts];
  readonly breakEven: BreakEven;
}

export interface CostValidationError {
  readonly status: 'error';
  readonly issues: readonly {
    readonly field: string;
    readonly message: string;
    readonly packageId?: string;
  }[];
}

export type CostResult = Costs | CostValidationError;

/** Vertical displacement is downward-positive. Retain original units/raw repeats; the UI stores their mean. */
export interface Reading {
  readonly id: string;
  readonly designId: string;
  readonly presetVersion: string;
  readonly appliedLoad: LoadCase;
  readonly measuredNodeId: NodeId;
  readonly displacement: number;
  readonly units: 'mm' | 'cm' | 'in';
  readonly method: string;
  readonly instrumentResolution: number | null;
  readonly rawReadings: readonly number[];
  readonly assessment: 'unassessed' | 'inconclusive' | 'resolved';
  readonly notes: string;
}
