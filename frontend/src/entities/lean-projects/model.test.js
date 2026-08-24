import test from 'node:test'
import assert from 'node:assert/strict'
import snapshot from '../../mocks/projectsSnapshot.json' with { type: 'json' }
import {
  METHOD_DEVELOPMENT_FIXED_HOURS,
  buildProjectsViewModel,
  canSelectMethodDevelopment,
  calculateProjectCost,
  getMethodLevel,
  getDepartmentMethodKeys,
  isCombinedFocusWithinBudget,
} from './model.js'

test('project method level thresholds map to expected levels', () => {
  assert.equal(getMethodLevel(0), 0)
  assert.equal(getMethodLevel(50), 1)
  assert.equal(getMethodLevel(125), 2)
  assert.equal(getMethodLevel(225), 3)
  assert.equal(getMethodLevel(350), 4)
  assert.equal(getMethodLevel(500), 5)
  assert.equal(getMethodLevel(700), 6)
})

test('project method interpolation returns 2.5 for 175h', () => {
  assert.equal(getMethodLevel(175), 2.5)
})

test('project method level is capped at 6', () => {
  assert.equal(getMethodLevel(9999), 6)
})

test('project cost formula is 100 euros per hour rounded to nearest 1000', () => {
  assert.equal(calculateProjectCost(50), 5000)
  assert.equal(calculateProjectCost(100), 10000)
})

test('combined 5S and projects focus cannot exceed 400h', () => {
  assert.equal(isCombinedFocusWithinBudget(400, 150, 260), false)
  assert.equal(isCombinedFocusWithinBudget(400, 150, 250), true)
})

test('method development uses fixed 50h', () => {
  assert.equal(METHOD_DEVELOPMENT_FIXED_HOURS, 50)
})

test('wrong methods are not offered for assembly or shipping', () => {
  const assemblyMethods = getDepartmentMethodKeys(snapshot, 'assembly')
  const shippingMethods = getDepartmentMethodKeys(snapshot, 'shipping')

  assert.equal(assemblyMethods.includes('smed'), false)
  assert.equal(assemblyMethods.includes('spc'), false)
  assert.equal(shippingMethods.includes('smed'), false)
  assert.equal(shippingMethods.includes('spc'), false)
})

test('progressive method with 0h selection shows Ei vaikutusta', () => {
  const viewModel = buildProjectsViewModel(snapshot, {
    selectionMap: {
      'machining:smed': 0,
    },
  })

  const machining = viewModel.departments.find((department) => department.key === 'machining')
  const smed = machining.methods.find((method) => method.key === 'smed')

  assert.equal(smed.impactCategory, 'Ei vaikutusta')
})

test('unselected method development shows fixed resources but consumes nothing', () => {
  const viewModel = buildProjectsViewModel(snapshot, {
    selectionMap: {
      'assembly:method-development': 0,
    },
  })

  const assembly = viewModel.departments.find((department) => department.key === 'assembly')
  const methodDevelopment = assembly.methods.find((method) => method.key === 'method-development')

  assert.equal(methodDevelopment.displayHours, 50)
  assert.equal(methodDevelopment.displayCost, 5000)
  assert.equal(methodDevelopment.displayImpactCategory, 'Pieni')
  assert.equal(methodDevelopment.selectedHours, 0)
  assert.equal(methodDevelopment.cost, 0)
})

test('selected method development consumes 50h and 5000 euros', () => {
  const viewModel = buildProjectsViewModel(snapshot, {
    selectionMap: {
      'assembly:method-development': 50,
    },
  })

  const assembly = viewModel.departments.find((department) => department.key === 'assembly')
  const methodDevelopment = assembly.methods.find((method) => method.key === 'method-development')

  assert.equal(methodDevelopment.selectedHours, 50)
  assert.equal(methodDevelopment.cost, 5000)
  assert.equal(viewModel.focus.projectsSelectedHours, 50)
  assert.equal(viewModel.costs.total, 5000)
})

test('method development cannot be selected when remaining focus is below 50h', () => {
  assert.equal(canSelectMethodDevelopment(49), false)
  assert.equal(canSelectMethodDevelopment(50), true)
})