# GLM-4.7 Integration in Server

This document describes how GLM-4.7 is integrated into the Automaker server, including environment injection, model routing, and two-phase execution.

## Overview

GLM-4.7 support is built on top of the existing Claude Provider infrastructure. Instead of creating a separate provider, we extend the Claude Provider to support per-request environment injection. This allows routing GLM models to Z.AI endpoint while maintaining code reusability.

## Architecture

### Provider Routing

The `ProviderFactory` routes models to appropriate providers:

```typescript
// apps/server/src/providers/provider-factory.ts

export class ProviderFactory {
  static getProviderForModel(model: string): BaseProvider {
    // GLM models go to ClaudeProvider with Z.AI endpoint
    if (model.startsWith('glm-')) {
      return new ClaudeProvider();
    }

    // Claude models
    if (model.startsWith('claude-') || CLAUDE_ALIASES.includes(model)) {
      return new ClaudeProvider();
    }

    // ... other providers
  }
}
```

**Key Points:**

- GLM models (`glm-*`) are routed to `ClaudeProvider`
- Z.AI endpoint injection happens at execution time, not routing time
- This enables dynamic endpoint switching based on profile configuration

### Environment Injection

The `ClaudeProvider` supports per-request environment injection via `providerConfig.env`:

```typescript
// apps/server/src/providers/claude-provider.ts

export class ClaudeProvider implements BaseProvider {
  async executeQuery(options: ExecuteOptions): AsyncGenerator<StreamMessage> {
    // Extract provider-specific environment from options
    const providerEnv = options.providerConfig?.env || {};

    // Merge with process.env for this request only
    const mergedEnv = {
      ...process.env,
      ...providerEnv,
    };

    // Use merged env when calling the SDK
    const stream = await query({
      prompt: options.prompt,
      model: options.model,
      // env option (if SDK supports it)
      env: mergedEnv,
      // ... other options
    });

    // Yield stream messages
    for await (const msg of stream) {
      yield msg;
    }
  }
}
```

### SDK Fallback

If the `@anthropic-ai/claude-agent-sdk` doesn't support per-request env injection:

```typescript
// Worker process fallback
if (!sdkSupportsEnv) {
  return this.executeViaWorkerProcess(options);
}

async executeViaWorkerProcess(options: ExecuteOptions): AsyncGenerator<StreamMessage> {
  // Spawn child process with custom env
  const worker = spawn('node', ['worker.js'], {
    env: {
      ...process.env,
      ...options.providerConfig?.env,
    },
  });

  // Stream messages back to parent
  worker.stdout.on('data', (data) => {
    const msg = JSON.parse(data.toString());
    yield msg;
  });
}
```

**Note**: The worker process approach keeps global `process.env` safe and supports concurrent requests.

## Two-Phase Execution

Auto Mode supports two-phase execution when `planningMode !== 'skip'`:

```typescript
// apps/server/src/services/auto-mode-service.ts

async runFeature(feature: Feature): Promise<void> {
  const planningModel = resolveModelString(
    feature.planningModel ?? feature.model
  );
  const implementationModel = resolveModelString(feature.model);

  // Phase 1: Planning
  if (this.planningMode !== 'skip') {
    await this.runPlanningPhase(planningModel, feature);
  }

  // Phase 2: Implementation
  await this.runImplementationPhase(implementationModel, feature);
}

private async runPlanningPhase(model: string, feature: Feature): Promise<void> {
  // Use planning model (e.g., Claude Opus)
  const env = this.getProviderEnv(model, feature);
  const stream = await this.provider.executeQuery({
    prompt: this.getPlanningPrompt(feature),
    model,
    providerConfig: { env },
    // ... other options
  });

  // Process stream until plan is generated
  for await (const msg of stream) {
    // Extract and save plan
    await this.processPlanningMessage(msg);
  }
}

private async runImplementationPhase(model: string, feature: Feature): Promise<void> {
  // Use implementation model (e.g., GLM-4.7)
  const env = this.getProviderEnv(model, feature);
  const stream = await this.provider.executeQuery({
    prompt: this.getImplementationPrompt(feature),
    model,
    providerConfig: { env },
    // ... other options
  });

  // Process stream for implementation
  for await (const msg of stream) {
    await this.processImplementationMessage(msg);
  }
}

private getProviderEnv(model: string, feature: Feature): Record<string, string> | undefined {
  // Check if this model needs Z.AI endpoint
  if (model.startsWith('glm-') || feature.implementationEndpointPreset === 'zai') {
    const zaiKey = this.settingsService.getCredentials().apiKeys.zai;
    if (!zaiKey) {
      throw new Error('Z.AI API key is required for GLM-4.7');
    }

    return {
      ANTHROPIC_BASE_URL:
        feature.implementationEndpointUrl || 'https://api.z.ai/api/anthropic',
      ANTHROPIC_AUTH_TOKEN: zaiKey,
      API_TIMEOUT_MS: '3000000', // 50 minutes
    };
  }

  // Custom endpoint override
  if (feature.implementationEndpointPreset === 'custom') {
    const customUrl = feature.implementationEndpointUrl;
    if (!customUrl) {
      throw new Error('Custom endpoint URL is required');
    }

    return {
      ANTHROPIC_BASE_URL: customUrl,
      ANTHROPIC_AUTH_TOKEN: this.settingsService.getCredentials().apiKeys.zai,
      API_TIMEOUT_MS: '3000000',
    };
  }

  // Default: no env override
  return undefined;
}
```

## Model Resolution

GLM models are resolved through the model resolver:

```typescript
// libs/model-resolver/src/resolver.ts

export function resolveModelString(model: string, defaultModel?: string): string {
  // GLM models: pass through
  if (model.startsWith('glm-')) {
    return model;
  }

  // Claude models: resolve aliases
  if (model === 'opus') return 'claude-opus-4-5-20251101';
  if (model === 'sonnet') return 'claude-sonnet-4-5-20251101';
  if (model === 'haiku') return 'claude-haiku-4-5-20251101';

  // Claude models: pass through
  if (model.startsWith('claude-')) {
    return model;
  }

  // Default fallback
  return defaultModel || 'claude-sonnet-4-5-20251101';
}
```

## Endpoint Configuration

### Z.AI Endpoint

Default endpoint for GLM-4.7:

```
https://api.z.ai/api/anthropic
```

### Custom Endpoints

Users can override the endpoint via profile or feature settings:

```typescript
interface AIProfile {
  model: 'glm-4.7';
  planningModel: 'opus';
  implementationEndpointPreset: 'custom';
  implementationEndpointUrl: 'https://custom-endpoint.com/api/anthropic';
}

interface Feature {
  model: 'glm-4.7';
  planningModel: 'opus';
  implementationEndpointPreset: 'custom';
  implementationEndpointUrl: 'https://custom-endpoint.com/api/anthropic';
}
```

### Endpoint Presets

Three presets control endpoint selection:

| Preset    | Description              | Base URL                               |
| --------- | ------------------------ | -------------------------------------- |
| `default` | Model's default endpoint | Claude → Anthropic, GLM → Z.AI         |
| `zai`     | Explicit Z.AI endpoint   | `https://api.z.ai/api/anthropic`       |
| `custom`  | User-specified URL       | From `implementationEndpointUrl` field |

## API Key Management

### Credentials Storage

Z.AI API keys are stored separately from Anthropic keys:

```typescript
// libs/types/src/settings.ts

interface Credentials {
  version: number;
  apiKeys: {
    anthropic: string; // Anthropic API key
    google: string; // Google API key
    openai: string; // OpenAI API key
    zai: string; // Z.AI API key (GLM-4.7)
  };
}
```

### Credentials Service

The `SettingsService` manages credentials:

```typescript
// apps/server/src/services/settings-service.ts

export class SettingsService {
  async getCredentials(): Promise<Credentials> {
    const data = await fs.readFile(path.join(this.dataDir, 'credentials.json'), 'utf-8');
    const parsed = JSON.parse(data);

    // Merge with defaults
    return {
      ...DEFAULT_CREDENTIALS,
      ...parsed,
    };
  }

  async updateCredentials(updates: Partial<Credentials>): Promise<Credentials> {
    const current = await this.getCredentials();
    const merged = deepMerge(current, updates);

    await fs.writeFile(
      path.join(this.dataDir, 'credentials.json'),
      JSON.stringify(merged, null, 2),
      'utf-8'
    );

    return merged;
  }
}
```

## Verification Endpoint

Z.AI key verification endpoint:

```typescript
// apps/server/src/routes/setup/routes/verify-zai-auth.ts

export function createVerifyZaiAuthHandler() {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const zaiKey = getApiKey('zai');

      if (!zaiKey) {
        return res.json({
          success: false,
          authenticated: false,
          error: 'Z.AI API key not found',
        });
      }

      // Test query with Z.AI env injection
      const result = await query({
        prompt: 'Say "OK" if you receive this.',
        model: 'glm-4.7',
        maxTurns: 1,
        env: {
          ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
          ANTHROPIC_AUTH_TOKEN: zaiKey,
          API_TIMEOUT_MS: '3000000',
        },
      });

      res.json({
        success: true,
        authenticated: true,
      });
    } catch (error) {
      const isAuthenticated = !isAuthError(error);

      res.json({
        success: isAuthenticated,
        authenticated: isAuthenticated,
        error: isAuthenticated ? undefined : getErrorMessage(error),
      });
    }
  };
}

function isAuthError(error: unknown): boolean {
  const errorStr = String(error).toLowerCase();
  return AUTH_ERROR_PATTERNS.some((pattern) => errorStr.includes(pattern));
}

const AUTH_ERROR_PATTERNS = [
  'invalid_api_key',
  'authentication_error',
  'unauthorized',
  'not authenticated',
  'authentication failed',
  'invalid api key',
  'api key is invalid',
  '401',
];
```

## Agent Chat Integration

GLM-4.7 is also available in Agent Chat:

```typescript
// apps/server/src/services/agent-service.ts

export class AgentService {
  async executeAgentRequest(request: AgentRequest): Promise<AsyncGenerator<StreamMessage>> {
    const model = request.model || this.getDefaultModel();

    // Get provider env if using GLM
    const env = this.getProviderEnv(model, request.credentials);

    const stream = await this.provider.executeQuery({
      prompt: request.prompt,
      model,
      providerConfig: { env },
      conversationHistory: request.conversationHistory,
      // ... other options
    });

    return stream;
  }

  private getProviderEnv(
    model: string,
    credentials: Credentials
  ): Record<string, string> | undefined {
    if (model.startsWith('glm-')) {
      const zaiKey = credentials.apiKeys.zai;
      if (!zaiKey) {
        throw new Error('Z.AI API key is required for GLM-4.7');
      }

      return {
        ANTHROPIC_BASE_URL: 'https://api.z.ai/api/anthropic',
        ANTHROPIC_AUTH_TOKEN: zaiKey,
        API_TIMEOUT_MS: '3000000',
      };
    }

    return undefined;
  }
}
```

## Error Handling

### Missing Z.AI Key

When GLM-4.7 is selected without Z.AI key:

```typescript
throw new Error(
  'Z.AI API key is required for GLM-4.7. ' + 'Please add your Z.AI key in Settings → API Keys.'
);
```

### Invalid Endpoint

Custom endpoint validation:

```typescript
if (feature.implementationEndpointPreset === 'custom') {
  const url = feature.implementationEndpointUrl;
  if (!url || !isValidUrl(url)) {
    throw new Error('Invalid custom endpoint URL');
  }
}
```

### Timeout Configuration

Z.AI recommends a long timeout (50 minutes):

```typescript
const GLM_TIMEOUT_MS = 3000000; // 50 minutes

// Injected via providerConfig.env
{
  API_TIMEOUT_MS: String(GLM_TIMEOUT_MS),
}
```

## Security Considerations

### Key Storage

- Keys are stored in `{DATA_DIR}/credentials.json`
- File is created with restricted permissions (read/write for owner only)
- Keys are never logged or included in error messages

### Endpoint Security

- All endpoints use HTTPS
- Custom endpoints should also use HTTPS
- No fallback to HTTP is allowed

### Environment Isolation

- Per-request env injection prevents cross-request contamination
- Worker process fallback ensures complete isolation
- Global `process.env` is never modified

## Testing

### Unit Tests

Test environment injection:

```typescript
describe('GLM Integration', () => {
  it('should inject Z.AI env for GLM models', async () => {
    const provider = new ClaudeProvider();
    const feature = createMockFeature({
      model: 'glm-4.7',
      implementationEndpointPreset: 'zai',
    });

    const env = getProviderEnv('glm-4.7', feature, credentials);

    expect(env?.ANTHROPIC_BASE_URL).toBe('https://api.z.ai/api/anthropic');
    expect(env?.ANTHROPIC_AUTH_TOKEN).toBe('mock-zai-key');
    expect(env?.API_TIMEOUT_MS).toBe('3000000');
  });

  it('should use custom endpoint when specified', async () => {
    const feature = createMockFeature({
      model: 'glm-4.7',
      implementationEndpointPreset: 'custom',
      implementationEndpointUrl: 'https://custom.com/api',
    });

    const env = getProviderEnv('glm-4.7', feature, credentials);

    expect(env?.ANTHROPIC_BASE_URL).toBe('https://custom.com/api');
  });
});
```

### Integration Tests

Test two-phase execution:

```typescript
describe('Auto Mode Two-Phase Execution', () => {
  it('should use planning model for phase 1', async () => {
    const feature = createMockFeature({
      planningModel: 'opus',
      model: 'glm-4.7',
    });

    await autoModeService.runFeature(feature);

    // Verify phase 1 used Opus
    expect(phase1ModelUsed).toBe('claude-opus-4-5-20251101');
  });

  it('should use GLM-4.7 for phase 2', async () => {
    const feature = createMockFeature({
      planningModel: 'opus',
      model: 'glm-4.7',
    });

    await autoModeService.runFeature(feature);

    // Verify phase 2 used GLM with Z.AI env
    expect(phase2ModelUsed).toBe('glm-4.7');
    expect(phase2Env?.ANTHROPIC_BASE_URL).toBe('https://api.z.ai/api/anthropic');
  });
});
```

## Performance Considerations

### Timeout Duration

Z.AI endpoint may have different latency characteristics than Anthropic:

- Recommended timeout: 50 minutes (vs 10 minutes for Anthropic)
- Allows GLM-4.7 to process complex prompts
- Timeout is configurable per profile/feature

### Concurrency

GLM-4.7 supports concurrent requests like Claude models:

- Multiple features can run simultaneously
- Each request uses independent env injection
- No global state conflicts

### Model Selection

Choosing between planning and implementation models:

| Planning Model | Implementation Model | Use Case                                   |
| -------------- | -------------------- | ------------------------------------------ |
| Claude Opus    | GLM-4.7              | High quality planning, fast implementation |
| Claude Sonnet  | GLM-4.7              | Balanced speed/quality                     |
| Claude Opus    | Claude Opus          | Maximum quality (expensive)                |

## References

- [Provider Architecture](./providers.md) - General provider system
- [GLM Setup Guide](../glm-setup-guide.md) - User-facing setup guide
- [Z.AI Documentation](https://docs.z.ai/devpack/tool/claude) - Official Z.AI docs
