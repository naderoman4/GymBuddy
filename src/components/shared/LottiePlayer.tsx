import Lottie from 'lottie-react'

interface LottiePlayerProps {
  animationData: object
  loop?: boolean
  autoplay?: boolean
  className?: string
  onComplete?: () => void
}

export default function LottiePlayer({
  animationData,
  loop = false,
  autoplay = true,
  className = '',
  onComplete,
}: LottiePlayerProps) {
  return (
    <Lottie
      animationData={animationData}
      loop={loop}
      autoplay={autoplay}
      className={className}
      onComplete={onComplete}
    />
  )
}
