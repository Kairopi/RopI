/**
 * ROPI icon set (Phosphor, https://phosphoricons.com)
 *
 * Exported under the names the app already used (from lucide), so screens
 * import from '@/components/icons' and the library can change in one place.
 *
 * Weights (see DESIGN.md):
 * - "duotone" for icons that carry meaning (nav, section and feature icons)
 * - "regular" for controls (arrows, close, check, chevrons)
 * - "bold" for the spinner so it stays visible when small
 * Pass weight="..." on any icon to override.
 */

import { forwardRef } from 'react';
import type { Icon as PhosphorIcon, IconProps, IconWeight } from '@phosphor-icons/react';
import {
  Pulse,
  WarningCircle,
  Warning,
  ArrowLeft as PArrowLeft,
  ArrowRight as PArrowRight,
  Medal,
  ChartBar,
  BookOpenText,
  Robot,
  Brain as PBrain,
  Briefcase as PBriefcase,
  Buildings,
  CalendarBlank,
  ClockCountdown,
  CalendarDots,
  Check as PCheck,
  CheckCircle as PCheckCircle,
  CheckSquare as PCheckSquare,
  CaretDown,
  CaretLeft,
  CaretRight,
  Circle as PCircle,
  Clock as PClock,
  Cards,
  Kanban as PKanban,
  ArrowSquareOut,
  File as PFile,
  Question,
  FileText as PFileText,
  SmileySad,
  GraduationCap as PGraduationCap,
  DotsSixVertical,
  Hash as PHash,
  SquaresFour,
  Lightbulb as PLightbulb,
  ListBullets,
  CircleNotch,
  SignOut,
  MapPin as PMapPin,
  List as PList,
  ChatText,
  Microphone,
  MicrophoneSlash,
  Pause as PPause,
  Play as PPlay,
  Plus as PPlus,
  ArrowsClockwise,
  ArrowCounterClockwise,
  ArrowClockwise,
  MagnifyingGlass,
  Shuffle as PShuffle,
  SkipForward as PSkipForward,
  Smiley,
  Target as PTarget,
  ThumbsDown as PThumbsDown,
  ThumbsUp as PThumbsUp,
  Trash as PTrash,
  TrendUp,
  Trophy as PTrophy,
  UploadSimple,
  User as PUser,
  SpeakerHigh,
  SpeakerSlash,
  X as PX,
  XCircle as PXCircle,
} from '@phosphor-icons/react';

export type { IconProps, IconWeight };

function make(Icon: PhosphorIcon, weight: IconWeight, name: string) {
  const C = forwardRef<SVGSVGElement, IconProps>((props, ref) => (
    <Icon ref={ref} weight={props.weight ?? weight} size={props.size ?? '1.25em'} aria-hidden={props['aria-label'] ? undefined : true} {...props} />
  ));
  C.displayName = name;
  return C;
}

// Meaningful icons: duotone
export const Activity = make(Pulse, 'duotone', 'Activity');
export const Award = make(Medal, 'duotone', 'Award');
export const BarChart3 = make(ChartBar, 'duotone', 'BarChart3');
export const BookOpen = make(BookOpenText, 'duotone', 'BookOpen');
export const Bot = make(Robot, 'duotone', 'Bot');
export const Brain = make(PBrain, 'duotone', 'Brain');
export const Briefcase = make(PBriefcase, 'duotone', 'Briefcase');
export const Building2 = make(Buildings, 'duotone', 'Building2');
export const Calendar = make(CalendarBlank, 'duotone', 'Calendar');
export const CalendarClock = make(ClockCountdown, 'duotone', 'CalendarClock');
export const CalendarDays = make(CalendarDots, 'duotone', 'CalendarDays');
export const CheckSquare = make(PCheckSquare, 'duotone', 'CheckSquare');
export const Clock = make(PClock, 'regular', 'Clock');
export const CreditCard = make(Cards, 'duotone', 'CreditCard');
export const File = make(PFile, 'duotone', 'File');
export const FileQuestion = make(Question, 'duotone', 'FileQuestion');
export const FileText = make(PFileText, 'duotone', 'FileText');
export const Frown = make(SmileySad, 'duotone', 'Frown');
export const GraduationCap = make(PGraduationCap, 'duotone', 'GraduationCap');
export const Hash = make(PHash, 'regular', 'Hash');
export const LayoutDashboard = make(SquaresFour, 'duotone', 'LayoutDashboard');
export const Lightbulb = make(PLightbulb, 'duotone', 'Lightbulb');
export const Kanban = make(PKanban, 'duotone', 'Kanban');
export const MapPin = make(PMapPin, 'duotone', 'MapPin');
export const MessageSquare = make(ChatText, 'duotone', 'MessageSquare');
export const Mic = make(Microphone, 'duotone', 'Mic');
export const MicOff = make(MicrophoneSlash, 'duotone', 'MicOff');
export const Smile = make(Smiley, 'duotone', 'Smile');
export const Target = make(PTarget, 'duotone', 'Target');
export const ThumbsDown = make(PThumbsDown, 'duotone', 'ThumbsDown');
export const ThumbsUp = make(PThumbsUp, 'duotone', 'ThumbsUp');
export const TrendingUp = make(TrendUp, 'bold', 'TrendingUp');
export const Trophy = make(PTrophy, 'duotone', 'Trophy');
export const User = make(PUser, 'duotone', 'User');
export const Volume2 = make(SpeakerHigh, 'duotone', 'Volume2');
export const VolumeX = make(SpeakerSlash, 'duotone', 'VolumeX');
// Deliberately not exported: sparkle/stars and lightning bolts read as generic
// "AI" decoration. Use an icon that says what the thing does, or no icon.

// Status: regular outline reads cleaner at small sizes
export const AlertCircle = make(WarningCircle, 'regular', 'AlertCircle');
export const AlertTriangle = make(Warning, 'regular', 'AlertTriangle');
export const CheckCircle = make(PCheckCircle, 'regular', 'CheckCircle');
export const CheckCircle2 = make(PCheckCircle, 'regular', 'CheckCircle2');
export const XCircle = make(PXCircle, 'regular', 'XCircle');
export const Circle = make(PCircle, 'regular', 'Circle');

// Controls: regular
export const ArrowLeft = make(PArrowLeft, 'regular', 'ArrowLeft');
export const ArrowRight = make(PArrowRight, 'regular', 'ArrowRight');
export const Check = make(PCheck, 'bold', 'Check');
export const ChevronDown = make(CaretDown, 'regular', 'ChevronDown');
export const ChevronLeft = make(CaretLeft, 'regular', 'ChevronLeft');
export const ChevronRight = make(CaretRight, 'regular', 'ChevronRight');
export const ExternalLink = make(ArrowSquareOut, 'regular', 'ExternalLink');
export const GripVertical = make(DotsSixVertical, 'bold', 'GripVertical');
export const List = make(ListBullets, 'regular', 'List');
export const LogOut = make(SignOut, 'regular', 'LogOut');
export const Menu = make(PList, 'regular', 'Menu');
export const Pause = make(PPause, 'fill', 'Pause');
export const Play = make(PPlay, 'fill', 'Play');
export const Plus = make(PPlus, 'regular', 'Plus');
export const RefreshCw = make(ArrowsClockwise, 'regular', 'RefreshCw');
export const RotateCcw = make(ArrowCounterClockwise, 'regular', 'RotateCcw');
export const RotateCw = make(ArrowClockwise, 'regular', 'RotateCw');
export const Search = make(MagnifyingGlass, 'regular', 'Search');
export const Shuffle = make(PShuffle, 'regular', 'Shuffle');
export const SkipForward = make(PSkipForward, 'fill', 'SkipForward');
export const Trash = make(PTrash, 'regular', 'Trash');
export const Trash2 = make(PTrash, 'regular', 'Trash2');
export const Upload = make(UploadSimple, 'regular', 'Upload');
export const X = make(PX, 'regular', 'X');

// Spinner
export const Loader2 = make(CircleNotch, 'bold', 'Loader2');
