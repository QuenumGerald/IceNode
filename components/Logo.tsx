export const Logo = ({ className = "", size = 40 }: { className?: string; size?: number }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Hexagone de glace */}
      <path
        d="M50 5L87.3013 25V65L50 85L12.6987 65V25L50 5Z"
        fill="#FFE5E5"
        stroke="#E84142"
        strokeWidth="3"
      />
      {/* Cristaux de glace intérieurs */}
      <path
        d="M50 15L70 25V45L50 55L30 45V25L50 15Z"
        fill="#FCA5A5"
        stroke="#E84142"
        strokeWidth="2"
      />
      {/* Point central */}
      <circle cx="50" cy="35" r="4" fill="#E84142" />
      {/* Lignes de connexion */}
      <path
        d="M50 35L65 45M50 35L35 45M50 35L50 15"
        stroke="#E84142"
        strokeWidth="2"
      />
    </svg>
  );
};
