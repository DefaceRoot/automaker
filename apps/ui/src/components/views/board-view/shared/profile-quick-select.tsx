import { Label } from '@/components/ui/label';
import { Brain, UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentModel, ThinkingLevel, AIProfile } from '@/store/app-store';
import { PROFILE_ICONS } from './model-constants';

interface ProfileQuickSelectProps {
  profiles: AIProfile[];
  selectedModel: AgentModel;
  selectedPlanningModel?: AgentModel;
  selectedThinkingLevel: ThinkingLevel;
  selectedImplementationEndpointPreset?: 'default' | 'zai' | 'custom';
  onSelect: (
    model: AgentModel,
    planningModel: AgentModel,
    thinkingLevel: ThinkingLevel,
    implementationEndpointPreset?: 'default' | 'zai' | 'custom'
  ) => void;
  testIdPrefix?: string;
  showManageLink?: boolean;
  onManageLinkClick?: () => void;
}

export function ProfileQuickSelect({
  profiles,
  selectedModel,
  selectedPlanningModel,
  selectedThinkingLevel,
  selectedImplementationEndpointPreset,
  onSelect,
  testIdPrefix = 'profile-quick-select',
  showManageLink = false,
  onManageLinkClick,
}: ProfileQuickSelectProps) {
  if (profiles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <UserCircle className="w-4 h-4 text-brand-500" />
          Quick Select Profile
        </Label>
        <span className="text-[11px] px-2 py-0.5 rounded-full border border-brand-500/40 text-brand-500">
          Presets
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {profiles.slice(0, 6).map((profile) => {
          const IconComponent = profile.icon ? PROFILE_ICONS[profile.icon] : Brain;
          const planningModel = profile.planningModel || profile.model;
          const isSelected =
            selectedModel === profile.model &&
            selectedThinkingLevel === profile.thinkingLevel &&
            (selectedPlanningModel === planningModel || !selectedPlanningModel) &&
            (selectedImplementationEndpointPreset === profile.implementationEndpointPreset || !selectedImplementationEndpointPreset);
          return (
            <button
              key={profile.id}
              type="button"
              onClick={() => onSelect(profile.model, planningModel, profile.thinkingLevel, profile.implementationEndpointPreset)}
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg border text-left transition-all',
                isSelected
                  ? 'bg-brand-500/10 border-brand-500 text-foreground'
                  : 'bg-background hover:bg-accent border-input'
              )}
              data-testid={`${testIdPrefix}-${profile.id}`}
            >
              <div className="w-7 h-7 rounded flex items-center justify-center shrink-0 bg-primary/10">
                {IconComponent && <IconComponent className="w-4 h-4 text-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{profile.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {profile.model}
                  {profile.thinkingLevel !== 'none' && ` + ${profile.thinkingLevel}`}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Or customize below.
        {showManageLink && onManageLinkClick && (
          <>
            {' '}
            Manage profiles in{' '}
            <button
              type="button"
              onClick={onManageLinkClick}
              className="text-brand-500 hover:underline"
            >
              AI Profiles
            </button>
          </>
        )}
      </p>
    </div>
  );
}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{profile.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {profile.model}
                  {profile.thinkingLevel !== 'none' && ` + ${profile.thinkingLevel}`}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Or customize below.
        {showManageLink && onManageLinkClick && (
          <>
            {' '}
            Manage profiles in{' '}
            <button
              type="button"
              onClick={onManageLinkClick}
              className="text-brand-500 hover:underline"
            >
              AI Profiles
            </button>
          </>
        )}
      </p>
    </div>
  );
}
