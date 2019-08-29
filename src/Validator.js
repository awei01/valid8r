module.exports = function Validator (schema, messages) {
  const keys = schema && Object.keys(schema)
  if (!keys || !keys.length) {
    throw new Error('Invalid schema')
  }
  messages = messages || {}
  if (!messages || typeof messages !== 'object' || Array.isArray(messages)) {
    throw new Error('Invalid messages')
  }

  const validators = keys.reduce((result, field) => {
    const fieldSchema = FieldValidator(schema[field])
    if (!fieldSchema) { throw new Error(`Invalid rules for field [${field}]`) }
    result[field] = fieldSchema
    return result
  }, {})

  function _resolveMessage (ruleName) {
    return ruleName && messages
      ? messages[ruleName] || messages.default || ruleName
      : ruleName
  }

  function validateField (field, data) {
    data = data || {}
    const value = data[field]
    const validateFn = validators[field]
    if (!validateFn) {
      console.warn(`Field [${field}] not in validation schema`)
      return Promise.resolve(null)
    }
    return validateFn(value, data)
      .then(_resolveMessage)
  }
  // function validateField (suppressMissingFieldError, field, data) {
  //   if (suppressMissingFieldError !== true) {
  //     data = field
  //     field = suppressMissingFieldError
  //     suppressMissingFieldError = false
  //   }
  //   data = data || {}
  //   const value = data[field]
  //   const validateFn = validators[field]
  //   if (!validateFn) {
  //     if (suppressMissingFieldError) {
  //       return Promise.resolve(null)
  //     }
  //     throw new Error(`Field [${field}] not in schema`)
  //   }
  //   return validateFn(value, data)
  //     .then(_resolveMessage)
  // }

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

  function extend (schemaFn, messagesFn) {
    if (schemaFn && typeof schemaFn !== 'function') { throw new Error('Cannot extend schema without function') }
    if (messagesFn && typeof messagesFn !== 'function') { throw new Error('Cannot extend messages without function') }
    const newSchema = schemaFn ? schemaFn(schema) : schema
    const newMessages = messagesFn ? messagesFn(messages) : messages
    return Validator(newSchema, messages)
  }

  return {
    validateField,
    validateAll,
    extend,
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
  if (!fieldSchema || Array.isArray(fieldSchema) || typeof fieldSchema !== 'object' || !Object.keys(fieldSchema).length) { return }
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

function _filterEmptyKeys (object) {
  return Object.keys(object).reduce((result, key) => {
    if (object[key]) {
      result[key] = object[key]
    }
    return result
  }, {})
}
