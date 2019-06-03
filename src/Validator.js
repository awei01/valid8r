module.exports = function (schema, messages) {
  const keys = schema && Object.keys(schema)
  if (!keys || !keys.length) {
    throw new Error('Invalid schema')
  }
  if (typeof messages !== 'undefined' && messages !== null && typeof messages !== 'object') {
    throw new Error('Invalid messages')
  }

  const validators = keys.reduce((result, field) => {
    const fieldSchema = schema[field]
    result[field] = FieldValidator(fieldSchema)
    return result
  }, {})

  function _resolveMessage (ruleName) {
    return ruleName && messages
      ? messages[ruleName] || messages.default || ruleName
      : ruleName
  }

  function validateField (suppressMissingFieldError, field, data) {
    if (suppressMissingFieldError !== true) {
      data = field
      field = suppressMissingFieldError
      suppressMissingFieldError = false
    }
    data = data || {}
    const value = data[field]
    const validateFn = validators[field]
    if (!validateFn) {
      if (suppressMissingFieldError) {
        return Promise.resolve(null)
      }
      throw new Error(`Field [${field}] not in schema`)
    }
    return validateFn(value, data)
      .then(_resolveMessage)
  }

  function validateAll (fields, data) {
    if (!Array.isArray(fields)) {
      data = fields
      fields = Object.keys(validators)
    }
    const promises = fields.map((key) => {
      return validateField(key, data)
        .then((error) => {
          return error ? { [key]: error } : null
        })
    })
    return Promise.all(promises)
      .then((errors) => {
        return errors.reduce((result, error) => {
          return error ? { ...result, ...error } : result
        }, null)
      })
  }

  return {
    validateField,
    validateAll,
    get requiredFields () {
      return Object.keys(schema).reduce((result, field) => {
        if (schema[field].isRequired) {
          result[field] = true
        }
        return result
      }, {})
    }
  }
}

function FieldValidator (fieldSchema) {
  const { isRequired, ...rules } = fieldSchema
  return function (...args) {
    const [value] = args
    const hasValue = typeof value !== 'undefined' && value !== null && value !== ''
    if (!hasValue) {
      return Promise.resolve(isRequired ? 'isRequired' : null)
    }
    return Object.keys(rules).reduce((acc, ruleName) => {
      return acc.then((invalidRule) => {
        if (invalidRule) { return acc }
        return Promise.resolve(rules[ruleName].apply(null, args))
          .then((result) => {
            return !result ? ruleName : null
          })
      })
    }, Promise.resolve(null))
  }
}
