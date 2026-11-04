type Props = {
  className?: string
}

// เส้นโครงร่างคนบาง ๆ วาดเอง ใช้แทนรูปถ่ายทุกจุดที่ต้องการสื่อถึง "คนลองชุด"
function BodyOutline({ className }: Props) {
  return (
    <svg aria-hidden viewBox="0 0 120 220" className={className}>
      <circle cx="60" cy="26" r="17" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M30 95 Q30 55 60 55 Q90 55 90 95 L90 165 L70 165 L70 215 L50 215 L50 165 L30 165 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  )
}

export default BodyOutline
