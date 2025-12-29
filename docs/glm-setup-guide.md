# GLM-4.7 Setup Guide

This guide explains how to configure and use GLM-4.7 (GLM Coding Plan) in Automaker for efficient plan-vs-code AI-assisted development.

## Overview

GLM-4.7 is a high-performance coding model available through Z.AI that excels at implementation tasks. When combined with a planning model (like Claude Opus), it enables a powerful two-phase workflow:

1. **Planning Phase**: Use Claude Opus to generate detailed plans and specifications
2. **Implementation Phase**: Use GLM-4.7 to implement the plan efficiently

This approach can significantly reduce costs while maintaining high code quality.

## Prerequisites

- A [Z.AI account](https://z.ai) with API access
- Automaker installed and running
- Anthropic API key (for planning models)

## Step 1: Add Z.AI API Key

1. Open Automaker
2. Navigate to **Settings** → **API Keys**
3. Find the **Z.AI (GLM Coding Plan)** section
4. Enter your Z.AI API key
5. Click **Test Connection** to verify the key works
6. Click **Save** to store the key

Your Z.AI API key is securely stored in `{DATA_DIR}/credentials.json`.

## Step 2: Create a GLM Profile

### Option A: Use Built-in GLM Profile

Automaker includes a built-in "GLM Coding" profile:

- **Planning Model**: Claude Opus
- **Implementation Model**: GLM-4.7
- **Endpoint**: Z.AI (automatic)

This profile is ready to use out of the box after adding your Z.AI API key.

### Option B: Create Custom Profile

1. Navigate to **Settings** → **Profiles**
2. Click **New Profile**
3. Configure the profile:
   - **Name**: Give your profile a descriptive name (e.g., "Fast Coding")
   - **Planning Model**: Select a planning model (e.g., Claude Opus or Sonnet)
   - **Implementation Model**: Select "GLM 4.7"
   - **Endpoint Preset**: Should default to "Z.AI" when GLM-4.7 is selected
4. (Optional) **Advanced Settings**:
   - **Custom Endpoint URL**: Override the default Z.AI endpoint if needed
   - **Thinking Level**: Set thinking level for implementation phase
5. Click **Save**

## Step 3: Use GLM Profile

### In Auto Mode (Feature Development)

1. Navigate to the **Board View**
2. Create or select a feature
3. Click **Quick Select** (or edit feature settings)
4. Choose your GLM profile
5. Set **Planning Mode** to one of:
   - **Lite**: Quick planning summary
   - **Spec**: Detailed specification
   - **Full**: Comprehensive plan with breakdown
6. Run the feature

Automaker will execute in two phases:

```
Phase 1 (Planning Model): Generate plan/spec
  ↓
Phase 2 (GLM-4.7 via Z.AI): Implement the plan
```

### In Agent Chat

1. Open the **Agent Chat** panel
2. In the model selector dropdown, choose **GLM 4.7**
3. Start chatting

Requests will be sent to the Z.AI endpoint using your Z.AI API key.

## Understanding Endpoint Presets

Profiles support three endpoint presets:

### Default (Automatic)

- Uses the model's default endpoint
- For Claude models: Anthropic API
- For GLM-4.7: Z.AI endpoint

### Z.AI

- Explicitly routes to Z.AI endpoint
- Always uses Z.AI API key
- Required for GLM-4.7

### Custom

- User-specified endpoint URL
- Still uses Z.AI API key for authentication
- Useful for custom deployments or alternative endpoints

## Profile Examples

### Example 1: Fast Coding Profile

```typescript
{
  name: "Fast Coding",
  description: "Quick planning with GLM-4.7 implementation",
  model: "glm-4.7",              // Implementation model
  planningModel: "sonnet",        // Planning model
  thinkingLevel: "medium",
  implementationEndpointPreset: "zai", // Use Z.AI endpoint
}
```

### Example 2: Premium Profile

```typescript
{
  name: "Premium Development",
  description: "Deep planning with GLM-4.7 implementation",
  model: "glm-4.7",              // Implementation model
  planningModel: "opus",         // Best planning model
  thinkingLevel: "high",
  implementationEndpointPreset: "zai",
}
```

### Example 3: Hybrid Profile (Custom Endpoint)

```typescript
{
  name: "Custom Endpoint",
  description: "GLM-4.7 with custom deployment",
  model: "glm-4.7",
  planningModel: "opus",
  implementationEndpointPreset: "custom",
  implementationEndpointUrl: "https://custom-endpoint.com/api/anthropic",
}
```

## Planning Modes Explained

### Lite Planning

- Quick, high-level plan
- 1-2 bullet points per task
- Best for: Simple features, experienced developers

### Spec Planning

- Detailed specification
- Technical requirements
- Edge cases considered
- Best for: Medium-complexity features

### Full Planning

- Comprehensive breakdown
- Step-by-step implementation guide
- Testing strategy included
- Best for: Complex features, architectural changes

## Configuration Reference

### Environment Variables

When using GLM-4.7, these environment variables are injected per-request:

| Variable               | Value                            | Description          |
| ---------------------- | -------------------------------- | -------------------- |
| `ANTHROPIC_BASE_URL`   | `https://api.z.ai/api/anthropic` | Z.AI API endpoint    |
| `ANTHROPIC_AUTH_TOKEN` | Your Z.AI API key                | Authentication token |
| `API_TIMEOUT_MS`       | `3000000` (50 minutes)           | Request timeout      |

### Model Resolution

GLM models are resolved through the model resolver:

- `glm-4.7` → Passed through to provider
- `glm-` prefixes → All recognized as GLM models
- Falls back to default if model unknown

## Troubleshooting

### Issue: "Missing Z.AI API Key"

**Solution**: Add your Z.AI API key in Settings → API Keys

### Issue: Profile Save Fails with GLM Selected

**Cause**: Z.AI API key is missing or empty

**Solution**:

1. Add Z.AI API key in Settings → API Keys
2. Test the connection
3. Try saving the profile again

### Issue: Connection Test Fails

**Possible Causes**:

1. Invalid API key
2. Network issues
3. Z.AI service downtime

**Solutions**:

1. Verify API key is correct in Z.AI dashboard
2. Check network connectivity
3. Check Z.AI status page

### Issue: Custom Endpoint Not Working

**Solution**:

1. Verify endpoint URL is accessible
2. Ensure endpoint follows Anthropic API format
3. Check that Z.AI API key works with custom endpoint

### Issue: Planning Model Selected But Not Used

**Cause**: Planning mode is set to "Skip"

**Solution**: Change planning mode to "Lite", "Spec", or "Full" in feature settings

## Best Practices

### 1. Choose Appropriate Planning Model

- **Claude Opus**: Complex architecture, migrations, deep debugging
- **Claude Sonnet**: Typical development tasks, balance of speed and quality
- **Claude Haiku**: Quick fixes, simple edits (less common for planning)

### 2. Match Planning Mode to Complexity

- **Simple feature**: Lite planning with GLM-4.7
- **Medium feature**: Spec planning with GLM-4.7
- **Complex feature**: Full planning with GLM-4.7

### 3. Test Profile Before Production

1. Create a test feature
2. Run with your GLM profile
3. Review generated plan and implementation
4. Adjust profile settings as needed

### 4. Monitor API Usage

GLM-4.7 is typically more cost-effective than Claude for implementation. Monitor your usage in Z.AI dashboard to optimize your workflow.

## Security Notes

- API keys are stored locally in `{DATA_DIR}/credentials.json`
- Keys are never transmitted to Automaker servers
- Z.AI endpoint uses HTTPS encryption
- Custom endpoints should also use HTTPS

## Migration from Claude-Only Profiles

If you have existing profiles using only Claude models:

1. Edit your profile
2. Add a **Planning Model** (set to your current model)
3. Change **Implementation Model** to GLM-4.7
4. Update **Endpoint Preset** to Z.AI
5. Save

This maintains your planning quality while improving implementation efficiency.

## API Reference

For detailed API information, see:

- [Z.AI Documentation](https://docs.z.ai/devpack/tool/claude)
- [Provider Architecture](./server/providers.md)
- [Model Types](../libs/types/src/model.ts)

## Support

For issues or questions:

1. Check [Troubleshooting](#troubleshooting) section
2. Review [Provider Architecture](./server/providers.md)
3. Check [Z.AI documentation](https://docs.z.ai)
4. Open an issue on [GitHub](https://github.com/your-repo/issues)
