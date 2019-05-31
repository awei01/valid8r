const Validator = require('~/Validator')

jest.useFakeTimers()

describe('Validator:', () => {
  describe('making a validator', () => {
    test('returns an object with valid schema', () => {
      expect(typeof Validator({ foo: { isRequired: true } })).toBe('object')
    })
    test('throws error w/ invalid schema', () => {
      expect(() => {
        Validator()
      }).toThrow('Invalid schema')

      expect(() => {
        Validator({})
      }).toThrow('Invalid schema')
    })
  })

  describe('.validateField()', () => {
    test('correctly calls each rule with [value, data] when each rule passes and resolves with [null]', () => {
      const rule1 = jest.fn().mockReturnValue(true)
      const rule2 = jest.fn().mockReturnValue(true)
      const validator = Validator({
        foo: { rule1, rule2 }
      })
      const data = { foo: 'foo value' }
      return validator.validateField('foo', data)
        .then((result) => {
          expect(rule1).toHaveBeenCalledWith('foo value', data)
          expect(rule2).toHaveBeenCalledWith('foo value', data)
          expect(result).toBe(null)
        })
    })

    test('stops calling on first failed rule and resolves with [failed rule name]', () => {
      const rule1 = jest.fn().mockReturnValue(true)
      const rule2 = jest.fn().mockReturnValue(false)
      const rule3 = jest.fn().mockReturnValue(true)
      const validator = Validator({
        foo: { rule1, rule2, rule2 }
      })
      const data = { foo: 'foo value' }
      return validator.validateField('foo', data)
        .then((result) => {
          expect(rule1).toHaveBeenCalledWith('foo value', data)
          expect(rule2).toHaveBeenCalledWith('foo value', data)
          expect(rule3).not.toHaveBeenCalled()
          expect(result).toBe('rule2')
        })
    })

    test('when isRequired is true and no value passed, does not call rule and resolves with [isRequired]', () => {
      const rule1 = jest.fn()
      const rule2 = jest.fn()
      const validator = Validator({
        foo: { isRequired: true, rule1, rule2 }
      })
      const data = { foo: null }
      return validator.validateField('foo', data)
        .then((result) => {
          expect(rule1).not.toHaveBeenCalled()
          expect(rule2).not.toHaveBeenCalled()
          expect(result).toBe('isRequired')
        })
    })

    test('when isRequired is falsey and no value passed, does not call rules and resolves with [null]', () => {
      const rule1 = jest.fn()
      const rule2 = jest.fn()
      const validator = Validator({
        foo: { rule1, rule2 }
      })
      const data = { foo: null }
      return validator.validateField('foo', data)
        .then((result) => {
          expect(rule1).not.toHaveBeenCalled()
          expect(rule2).not.toHaveBeenCalled()
          expect(result).toBe(null)
        })
    })

    test('can handle rules that return promises', () => {
      const rule1 = jest.fn().mockReturnValue(Promise.resolve(true))
      const rule2 = jest.fn().mockReturnValue(Promise.resolve(false))
      const validator = Validator({
        foo: { rule1, rule2 }
      })
      const data = { foo: 'foo value' }
      return validator.validateField('foo', data)
        .then((result) => {
          expect(rule1).toHaveBeenCalledWith('foo value', data)
          expect(rule2).toHaveBeenCalledWith('foo value', data)
          expect(result).toBe('rule2')
        })
    })

    test('when called with [key not in schema, data] throws', () => {
      const validator = Validator({
        foo: { isRequired: true }
      })
      expect(() => {
        validator.validateField('bar', {})
      }).toThrow('Field [bar] not in schema')
    })

    test('when called with [true, key not in schema, data] resolves with null', () => {
      const validator = Validator({
        foo: { isRequired: true }
      })
      validator.validateField(true, 'bar', {})
        .then((result) => {
          expect(result).toBe(null)
        })
    })

    test('when called with [key, falsey], it does not throw', () => {
      const validator = Validator({
        foo: { isRequired: true }
      })
      expect(() => {
        validator.validateField('foo')
      }).not.toThrow()
    })
  })

  describe('.validateAll()', () => {
    test('when called with [invalid data] resolves with [object of field errors]', () => {
      const validator = Validator({
        foo: { isRequired: true },
        bar: { isRequired: true, rule1: jest.fn() }
      })
      return validator.validateAll({ bar: 'value' })
        .then((result) => {
          expect(result).toEqual({ foo: 'isRequired', 'bar': 'rule1' })
        })
    })
    test('when called with [valid data] resolves with [null]', () => {
      const validator = Validator({
        foo: { isRequired: true },
        bar: { isRequired: true, rule1: jest.fn().mockReturnValue(true) }
      })
      return validator.validateAll({ foo: 'value', bar: 'value' })
        .then((result) => {
          expect(result).toBe(null)
        })
    })
    test('when called with [array of keys, data] only runs validator on keys and resolves with [errors]', () => {
      const rule1 = jest.fn()
      const rule2 = jest.fn()
      const validator = Validator({
        foo: { isRequired: true, rule1 },
        bar: { isRequired: true, rule2 }
      })
      const data = { foo: 'value', bar: 'value' }
      return validator.validateAll(['foo'], data)
        .then((result) => {
          expect(result).toEqual({ foo: 'rule1' })
          expect(rule1).toHaveBeenCalledWith('value', data)
          expect(rule2).not.toHaveBeenCalled()
        })
    })
    test('when called with falsey data still works', () => {
      const validator = Validator({
        foo: { isRequired: true },
        bar: { isRequired: true }
      })
      return validator.validateAll()
        .then((result) => {
          expect(result).toEqual({ foo: 'isRequired', 'bar': 'isRequired' })
        })
    })
  })

  test('requiredFields returns of object of fields that are .isRequired', () => {
    const validator = Validator({
      foo: { isRequired: true },
      bar: { rule1: jest.fn() },
      baz: { isRequired: true }
    })
    expect(validator.requiredFields).toEqual({ foo: true, baz: true })
  })

  describe('when created with [schema, object of messges]', () => {
    test('validateAll() with [valid data] when messages.default defined resolves with [null]', () => {
      const validator = Validator({
        foo: { rule1: jest.fn().mockReturnValue(true) },
        bar: { rule2: jest.fn().mockReturnValue(true) }
      }, {
        default: 'some default'
      })
      return validator.validateAll({ foo: 'value', bar: 'value' })
        .then((result) => {
          expect(result).toBe(null)
        })
    })
    test('validateField() with [invalid data] resolves with [rule message]', () => {
      const validator = Validator({
        foo: { rule1: jest.fn() }
      }, {
        rule1: 'rule1 message'
      })
      return validator.validateField('foo', { foo: 'value' })
        .then((result) => {
          expect(result).toBe('rule1 message')
        })
    })
    test('validateField() with [invalid data where message not defined] resolves with [message.default]', () => {
      const validator = Validator({
        foo: { rule1: jest.fn() }
      }, {
        default: 'default message'
      })
      return validator.validateField('foo', { foo: 'value' })
        .then((result) => {
          expect(result).toBe('default message')
        })
    })
    test('validateField() with [invalid data where message and default not defined] resolves with [ruleName]', () => {
      const validator = Validator({
        foo: { rule1: jest.fn() }
      }, {})
      return validator.validateField('foo', { foo: 'value' })
        .then((result) => {
          expect(result).toBe('rule1')
        })
    })
    test('constructed with invalid rules, throws', () => {
      expect(() => {
        Validator({ foo: { isRequired: true } }, 1)
      }).toThrow('Invalid messages')
    })
  })
})
