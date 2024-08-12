import { SchemaDefinition } from '../Types';

export class TypedSchema {
  public schema: SchemaDefinition;

  constructor(schema: SchemaDefinition) {
    this.schema = schema;
  }

  validate(data: any): boolean {
    return this.validateObject(data, this.schema);
  }

  private validateObject(data: any, schema: SchemaDefinition): boolean {
    if (typeof data !== 'object' || data === null) {
      return false;
    }

    for (const [key, type] of Object.entries(schema)) {
      if (!(key in data)) {
        return false;
      }

      if (!this.validateValue(data[key], type)) {
        return false;
      }
    }

    return true;
  }

  private validateValue(value: any, type: string | SchemaDefinition): boolean {
    if (typeof type === 'string') {
      switch (type) {
        case 'string':
          return typeof value === 'string';
        case 'number':
          return typeof value === 'number';
        case 'boolean':
          return typeof value === 'boolean';
        case 'object':
          return typeof value === 'object' && value !== null;
        case 'array':
          return Array.isArray(value);
        default:
          return false;
      }
    } else if (typeof type === 'object') {
      return this.validateObject(value, type);
    }

    return false;
  }

  cast(data: any): any {
    return this.castObject(data, this.schema);
  }

  private castObject(data: any, schema: SchemaDefinition): any {
    const result: any = {};

    for (const [key, type] of Object.entries(schema)) {
      if (key in data) {
        result[key] = this.castValue(data[key], type);
      }
    }

    return result;
  }

  private castValue(value: any, type: string | SchemaDefinition): any {
    if (typeof type === 'string') {
      switch (type) {
        case 'string':
          return String(value);
        case 'number':
          return Number(value);
        case 'boolean':
          return Boolean(value);
        case 'object':
          return typeof value === 'object' ? value : {};
        case 'array':
          return Array.isArray(value) ? value : [];
        default:
          return value;
      }
    } else if (typeof type === 'object') {
      return this.castObject(value, type);
    }

    return value;
  }

  getDefaultValue(): any {
    return this.getDefaultValueForSchema(this.schema);
  }

  private getDefaultValueForSchema(schema: SchemaDefinition): any {
    const result: any = {};

    for (const [key, type] of Object.entries(schema)) {
      result[key] = this.getDefaultValueForType(type);
    }

    return result;
  }

  private getDefaultValueForType(type: string | SchemaDefinition): any {
    if (typeof type === 'string') {
      switch (type) {
        case 'string':
          return '';
        case 'number':
          return 0;
        case 'boolean':
          return false;
        case 'object':
          return {};
        case 'array':
          return [];
        default:
          return null;
      }
    } else if (typeof type === 'object') {
      return this.getDefaultValueForSchema(type);
    }

    return null;
  }
}