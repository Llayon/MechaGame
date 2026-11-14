import { SectorId, TACTICAL_PINS } from '../map/sectors';
import { TacticalPin } from './objects/TacticalPin';

interface TacticalMarkersProps {
  visible: boolean;
  activeSector: SectorId;
  onSelectSector: (id: SectorId) => void;
}

export function TacticalMarkers({
  visible,
  activeSector,
  onSelectSector,
}: TacticalMarkersProps) {
  if (!visible) return null;

  return (
    <group>
      {TACTICAL_PINS.map((pin) => (
        <TacticalPin
          key={pin.id}
          pin={pin}
          isActive={activeSector === pin.sectorId}
          onSelect={onSelectSector}
        />
      ))}
    </group>
  );
}
