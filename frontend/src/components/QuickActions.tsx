type QuickAction = {
  label: string
  variant?: 'primary' | 'ghost' | 'soft'
  onClick?: () => void
  disabled?: boolean
}

type QuickActionsProps = {
  actions: QuickAction[]
}

export function QuickActions({ actions }: QuickActionsProps) {
  return (
    <div className="quick-actions">
      {actions.map((action) => (
        <button
          key={action.label}
          className={`quick-action quick-action--${action.variant ?? 'ghost'}`}
          type="button"
          onClick={action.onClick}
          disabled={action.disabled}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
