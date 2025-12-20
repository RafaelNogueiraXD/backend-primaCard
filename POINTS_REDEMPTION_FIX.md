# Points Redemption Logic Fix

## Problem

A lógica de resgate de recompensas estava utilizando os pontos na ordem incorreta, não respeitando a priorização adequada dos buckets (baldes de pontos).

### Cenário Exemplo:

**Saldo do usuário:**
- **1139 pontos totais**
  - 109 pontos gerais (general)
  - 30 pontos de limpeza (cleaning)
  - 1000 pontos de clareamento (whitening)

### Comportamento Anterior (INCORRETO):

#### Caso 1: Recompensa de 130 pontos (sem usar clareamento)
❌ **Estava fazendo:** Usava 30 de limpeza + 100 de clareamento (ERRADO!)
✅ **Deveria fazer:** Usar 109 gerais + 21 de limpeza

#### Caso 2: Recompensa de 1000 pontos (sem usar limpeza)
❌ **Estava fazendo:** Usava 1000 de clareamento (correto por coincidência)
✅ **Deveria fazer:** Usar 109 gerais + 891 de clareamento

### Lógica Incorreta:
```typescript
// ANTES (ERRADO):
// 1. Usava buckets específicos primeiro (limpeza, clareamento, etc)
// 2. Depois usava general
// 3. Não ordenava por quantidade
```

## Solution

Implementada a lógica correta de priorização de pontos:

### Nova Lógica (CORRETA):

#### Prioridade de Uso:
1. **Primeiro: Bucket GENERAL** (sempre que disponível e não excluído)
2. **Depois: Buckets específicos ordenados por quantidade (maior → menor)**
3. **Último: Limpeza** (implicitamente, pois geralmente tem menos pontos)

### Implementação:

```typescript
async canAfford(
  userId: string,
  cost: number,
  allowedBuckets: string[],
  excludedBuckets: string[]
): Promise<{ canAfford: boolean; breakdown?: { [bucket: string]: number } }> {
  const balances = await this.getBalance(userId);

  // Filter buckets based on rules
  const usableBuckets = Object.keys(balances).filter(
    bucket => 
      (allowedBuckets.length === 0 || allowedBuckets.includes(bucket)) &&
      !excludedBuckets.includes(bucket) &&
      balances[bucket] > 0
  );

  let remaining = cost;
  const breakdown: { [bucket: string]: number } = {};

  // ✅ Priority 1: Use general bucket first (unless excluded)
  if (remaining > 0 && usableBuckets.includes('general')) {
    const available = balances['general'];
    const toUse = Math.min(available, remaining);

    breakdown['general'] = toUse;
    remaining -= toUse;
  }

  // ✅ Priority 2: Use specific category buckets, ordered by balance (highest first)
  if (remaining > 0) {
    const specificBuckets = usableBuckets
      .filter(b => b !== 'general')
      .sort((a, b) => balances[b] - balances[a]); // Sort descending by balance

    for (const bucket of specificBuckets) {
      if (remaining <= 0) break;

      const available = balances[bucket];
      const toUse = Math.min(available, remaining);

      breakdown[bucket] = toUse;
      remaining -= toUse;
    }
  }

  return {
    canAfford: remaining <= 0,
    breakdown: remaining <= 0 ? breakdown : undefined,
  };
}
```

## Test Cases

### Cenário 1: Recompensa de 130 pontos (excludedBuckets: ['whitening'])

**Saldo:**
- general: 109
- cleaning: 30
- whitening: 1000

**Resultado:**
```json
{
  "canAfford": true,
  "breakdown": {
    "general": 109,
    "cleaning": 21
  }
}
```

**Explicação:**
1. Usa 109 do general (sobram 21)
2. Whitening está excluído, não pode usar
3. Usa 21 do cleaning
4. Total: 130 ✅

### Cenário 2: Recompensa de 1000 pontos (excludedBuckets: ['cleaning'])

**Saldo:**
- general: 109
- cleaning: 30
- whitening: 1000

**Resultado:**
```json
{
  "canAfford": true,
  "breakdown": {
    "general": 109,
    "whitening": 891
  }
}
```

**Explicação:**
1. Usa 109 do general (sobram 891)
2. Cleaning está excluído, não pode usar
3. Usa 891 do whitening (que tem mais pontos que outros)
4. Total: 1000 ✅

### Cenário 3: Recompensa de 50 pontos (sem exclusões)

**Saldo:**
- general: 109
- cleaning: 30
- whitening: 1000

**Resultado:**
```json
{
  "canAfford": true,
  "breakdown": {
    "general": 50
  }
}
```

**Explicação:**
1. Usa apenas 50 do general
2. Não precisa usar outros buckets
3. Total: 50 ✅

### Cenário 4: Recompensa de 150 pontos (excludedBuckets: ['general'])

**Saldo:**
- general: 109
- cleaning: 30
- whitening: 1000

**Resultado:**
```json
{
  "canAfford": true,
  "breakdown": {
    "whitening": 150
  }
}
```

**Explicação:**
1. General está excluído, não pode usar
2. Whitening tem mais pontos (1000) que cleaning (30)
3. Usa 150 do whitening primeiro
4. Total: 150 ✅

### Cenário 5: Recompensa de 1100 pontos (excludedBuckets: ['general', 'whitening'])

**Saldo:**
- general: 109
- cleaning: 30
- whitening: 1000

**Resultado:**
```json
{
  "canAfford": false,
  "breakdown": undefined
}
```

**Explicação:**
1. General excluído
2. Whitening excluído
3. Só pode usar cleaning (30 pontos)
4. Insuficiente! ❌

## Rules Summary

### Priorização de Pontos:

1. **SEMPRE usar GENERAL primeiro** (a menos que esteja excluído)
2. **Depois usar buckets específicos em ordem decrescente de saldo:**
   - Whitening (1000) → usa primeiro
   - Cleaning (30) → usa por último
3. **Respeitar allowedBuckets e excludedBuckets:**
   - `allowedBuckets`: Array vazio = todos permitidos
   - `excludedBuckets`: Buckets que NÃO podem ser usados
4. **Apenas buckets com saldo > 0 são considerados**

### Benefícios da Nova Lógica:

✅ **Preserva pontos específicos:** Usa general primeiro, economizando pontos de categoria
✅ **Otimiza uso de pontos:** Quando precisa usar específicos, usa os que têm mais saldo
✅ **Previsível e justo:** Comportamento consistente em todos os casos
✅ **Flexível:** Respeita regras de allowedBuckets e excludedBuckets

## Files Modified

- **`backend-primaCard/src/modules/points/points.service.ts`**
  - Modified `canAfford()` method (lines 165-212)
  - Changed priority: general first, then specific buckets sorted by balance descending

## Impact

- ✅ Redemption logic now follows correct priority order
- ✅ General points used first (most flexible)
- ✅ Category points preserved when possible
- ✅ When category points needed, uses highest balance first
- ✅ Cleaning points used last (typically lowest balance)
- ✅ All existing redemptions continue to work (no breaking changes)
- ✅ Future redemptions will use optimized point allocation

## Testing

To test the fix:

1. Create a user with mixed point balances:
   ```sql
   -- General: 109, Cleaning: 30, Whitening: 1000
   ```

2. Create a reward with cost 130 and excludedBuckets: ['whitening']
3. Redeem the reward
4. Check the breakdown in the redemption record
5. Should use: { general: 109, cleaning: 21 }

6. Create another reward with cost 1000 and excludedBuckets: ['cleaning']
7. Redeem the reward
8. Should use: { general: 109, whitening: 891 }
