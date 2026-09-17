export const DEFAULT_FACTORY_SETTINGS = {
  meta: {
    version: 1,
  },

  game: {
    totalRounds: 12,
    monthsPerRound: 3,
    hoursPerMachinePerRound: 1040,
    hoursPerWorkerPerRound: 1040,
  },

  market: {
    referencePrice: 25000,
    baseDemandPerVariation: 10,
    priceElasticity: -4,
  },

  production: {
    initialProductionQuantity: 188,
    hoursPerMachinePerRound: 1040,
    hoursPerWorkerPerRound: 1040,
    workersPerMachine: 5,
    initialBatchSize: 20,
    minBatchSize: 1,
    maxBatchSize: 20,
    departments: {
      machining: {
        normHoursPerContainer: 6,
        otherDowntimeRate: 0.24,
      },
      assembly: {
        normHoursPerContainer: 90,
      },
      shipping: {
        normHoursPerContainer: 10,
      },
    },
  },

  history: {
    knl: {
      roundMinusOne: {
        machining: { kPct: 89, nPct: 92, lPct: 77 },
        assembly: { kPct: 83, nPct: 77, lPct: 78 },
        shipping: { kPct: 79, nPct: 75, lPct: 76 },
        factory: { kPct: 84, nPct: 82, lPct: 77 },
      },
    },
  },

  lean: {
    fiveS: {
      maxHours: 1600,
      contributionDivisor: 3,
      levelThresholds: [
        { level: 0, hours: 0 },
        { level: 1, hours: 189 },
        { level: 2, hours: 474 },
        { level: 3, hours: 711 },
        { level: 4, hours: 1066 },
        { level: 5, hours: 1600 },
      ],
      currentDepartmentWeights: {
        machining: 0.42,
        assembly: 0.35,
        shipping: 0.23,
      },
    },
    methods: {
      levelThresholds: [
        { level: 0, hours: 0 },
        { level: 1, hours: 50 },
        { level: 2, hours: 125 },
        { level: 3, hours: 225 },
        { level: 4, hours: 350 },
        { level: 5, hours: 500 },
        { level: 6, hours: 700 },
      ],
      fixedHours: 50,
      costPerHour: 100,
      costRounding: 1000,
      maxEffectiveHours: 700,
    },
    smed: {
      initialSetupTimeHours: 10,
      minimumSetupTimeHours: 0.5,
      decayHours: 450,
      baseSetupCurveHours: 450,
      automationReductionMinutesPerMachine: 10,
      automationScope: 'machining',
    },
    tpm: {
      initialDowntimeRate: 0.1,
      minimumDowntimeRate: 0.01,
      decayHours: 450,
      availabilityBonusPctPoints: 2,
    },
    quality: {
      baseAvailabilityPct: 70,
      baseQualityPct: 70,
      maxPct: 0.95,
      curveHours: 1200,
      spcContributesToQuality: true,
      pokaYokeContributesToQuality: true,
    },
    performance: {
      machiningBasePct: 0.9,
      defaultBasePct: 70,
      maxPerformance: 0.95,
    },
  },

  variationRules: {
    minimumQualityForZeroAdditionalVariations: 0.75,
    minimumQualityForOneAdditionalVariation: 0.75,
    minimumQualityForTwoAdditionalVariations: 0.8,
    oneVariationMinQuality: 0.8,
    twoVariationMinQuality: 0.8,
    maxNewVariationsBelowThreshold: 0,
    maxNewVariationsAtOrAbove75Pct: 1,
    maxNewVariationsAtOrAbove80Pct: 2,
  },

  costs: {
    materialCostPerContainer: 12000,
    annualEmployeeCost: 105000,
    annualFixedCosts: 4000000,
  },

  finance: {
    annualInterestRate: 0.05,
    maxDebtToEquity: 2,
    machineryDepreciationPerRound: 0.05,
    buildingDepreciationPerRound: 0.025,
    targetCash: 50000,
    otherLiabilitiesRawMaterialShare: 0.5,
  },

  inventory: {
    finishedGoodsValuePerContainer: 20000,
    finishedGoodsSpacePerContainerM2: 15,
    productionRunsPerVariationDefault: 2,
  },

  factory: {
    machineSpaceM2: 250,
    workerSpaceM2: 25,
    factoryExpansionM2: 1000,
    dispatchSpaceM2: 250,
    officeAndSocialSpaceM2: 200,
  },

  investments: {
    newMachine: {
      type: 'new-machine',
      scope: 'factory',
      repeatable: true,
      price: 500000,
      spaceEffectM2: 250,
      staffingEffectWorkers: 5,
      capacityEffectHoursPerRound: 1040,
      depreciationPerRound: 0.05,
    },
    factoryExpansion: {
      type: 'factory-expansion',
      scope: 'factory',
      repeatable: true,
      price: 1000000,
      spaceEffectM2: 1000,
      depreciationPerRound: 0.025,
    },
    setupAutomation: {
      type: 'mold-change-automation',
      scope: 'machining',
      repeatable: false,
      price: 250000,
      unlockThreshold: {
        method: 'smed',
        level: 4,
      },
      setupTimeReductionMinutesPerMachine: 10,
      depreciationPerRound: 0.05,
      installedMachineIds: [2],
    },
    automaticProcessMeasurement: {
      type: 'automatic-process-measurement',
      scope: 'factory',
      repeatable: false,
      price: 250000,
      unlockThreshold: {
        method: 'spc',
        level: 4,
      },
      qualityBonusPctPoints: 2,
      depreciationPerRound: 0.05,
      installed: false,
    },
    conditionMonitoring: {
      type: 'condition-monitoring',
      scope: 'factory',
      repeatable: false,
      price: 200000,
      unlockThreshold: {
        method: 'tpm',
        level: 4,
      },
      availabilityBonusPctPoints: 2,
      depreciationPerRound: 0.05,
      installed: false,
    },
  },

  initialState: {
    round: 1,

    market: {
      price: 25000,
      activeVariations: 20,
      productionRunsPerVariation: 2,
    },

    production: {
      machiningMachines: 2,
    },

    staffing: {
      assembly: 38,
      shipping: 5,
    },

    lean: {
      fiveS: {
        focusBudgetHours: 400,
        departments: {
          machining: {
            effectiveHours: 569,
            weight: 0.42,
          },
          assembly: {
            effectiveHours: 747,
            weight: 0.35,
          },
          shipping: {
            effectiveHours: 417,
            weight: 0.23,
          },
        },
      },
      methods: {
        machining: {
          smed: 175,
          tpm: 145,
          spc: 100,
        },
        assembly: {
          'method-development': 50,
          tpm: 210,
          'poka-yoke': 120,
        },
        shipping: {
          'method-development': 50,
          tpm: 160,
          'poka-yoke': 90,
        },
      },
    },

    factory: {
      totalAreaM2: 4000,
      dispatchM2: 250,
      officeAndSocialM2: 200,
      expansionsCount: 0,
    },

    investments: {
      setupAutomation: {
        installedMachineIds: [],
      },
      automaticProcessMeasurement: {
        installed: false,
      },
      conditionMonitoring: {
        installed: false,
      },
    },

    inventory: {
      finishedGoodsContainers: 82.25,
    },

    finance: {
      cash: 50000,
      bankLoans: 2957900,
      overdraft: 0,
      equity: 2073975,
      otherLiabilities: 660000,
      machineryBookValue: 498750,
      buildingsBookValue: 2998125,
      finishedGoodsInventoryBookValue: 1645000,
      rawMaterialInventoryBookValue: 500000,
      inventoryBookValue: 2145000,
      incomeStatement: {
        sales: 132,
        revenue: 3300000,
        inventoryChange: 50000,
        materials: 1320000,
        labor: 1500000,
        fixedCosts: 750000,
        depreciation: 103125,
        financingCosts: 17500,
      },
      history: {
        previousRoundIncomeStatement: {
          round: -1,
          sales: 132,
          revenue: 3310000,
          inventoryChange: 50000,
          materials: 1318000,
          labor: 1498000,
          fixedCosts: 759000,
          depreciation: 112000,
          financingCosts: 16000,
        },
        previousRoundBalanceSheet: {
          round: -1,
          assets: {
            buildings: 3075000,
            machineryAndEquipment: 525000,
            finishedGoodsInventory: 1620000,
            rawMaterialInventory: 510000,
            cash: 50000,
          },
          equityAndLiabilities: {
            equity: 2414600,
            bankLoans: 2706400,
            otherLiabilities: 659000,
            overdraft: 0,
          },
        },
      },
    },
  },
}