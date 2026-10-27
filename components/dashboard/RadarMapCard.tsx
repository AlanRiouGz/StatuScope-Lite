import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import {
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { MapControlButton } from './MapControlButton';
import { MapLegend } from './MapLegend';

export interface RadarMapPin {
  id?: string;
  top?: string;
  left?: string;
  latitude?: number | null;
  longitude?: number | null;
  borderColor: string;
  fillColor?: string;
  icon?: React.ReactNode;
  label?: string;
  onPress?: () => void;
}

export interface RadarMapPolygon {
  id: string;
  geometry: {
    type: 'MultiPolygon';
    coordinates: number[][][][];
  };
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  onPress?: () => void;
}

export interface RadarMapCardProps {
  title: string;
  subtitle?: string;
  legendItems?: { label: string; color: string }[];
  showOverlayPanel?: boolean;
  overlayTitle?: string;
  overlayBadgeLabel?: string;
  overlayItems?: { label: string; value: string; color?: string }[];
  showControls?: boolean;
  footerTextLeft?: string;
  footerTextRight?: string;
  mapImageUri?: string;
  style?: StyleProp<ViewStyle>;
  showHeader?: boolean;
  showFooter?: boolean;
  mapHeight?: number;
  mapCenterLatitude?: number;
  mapCenterLongitude?: number;
  mapZoom?: number;
  minZoom?: number;
  maxZoom?: number;
  mapBounds?: { minLatitude: number; maxLatitude: number; minLongitude: number; maxLongitude: number };
  enablePan?: boolean;
  onMapHoverChange?: (isHovering: boolean) => void;
  surveillanceRadiusKm?: number;
  pins?: RadarMapPin[];
  polygons?: RadarMapPolygon[];
  bottomRightActionLabel?: string;
  onBottomRightActionPress?: () => void;
}

const defaultPins: RadarMapPin[] = [
  {
    top: '49%',
    left: '48%',
    borderColor: '#EF4444',
    icon: <MaterialCommunityIcons name="alert" size={16} color="#EF4444" />,
  },
  {
    top: '33%',
    left: '63%',
    borderColor: '#0003B8',
    icon: <MaterialCommunityIcons name="hospital-box-outline" size={12} color="#0003B8" />,
  },
];

export function RadarMapCard({
  title,
  subtitle,
  legendItems,
  showOverlayPanel = false,
  overlayTitle,
  overlayBadgeLabel,
  overlayItems,
  showControls = false,
  footerTextLeft,
  footerTextRight,
  mapImageUri,
  style,
  showHeader = false,
  showFooter = true,
  mapHeight = 520,
  mapCenterLatitude,
  mapCenterLongitude,
  mapZoom = 10,
  minZoom = mapZoom,
  maxZoom = 18,
  mapBounds,
  enablePan = false,
  onMapHoverChange,
  surveillanceRadiusKm,
  pins,
  polygons,
  bottomRightActionLabel,
  onBottomRightActionPress,
}: RadarMapCardProps) {
  const mapPins = pins ?? defaultPins;
  const mapPolygons = polygons ?? [];
  const [mapWidths, setMapWidths] = useState({ inline: 0, fullscreen: 0 });
  const [currentZoom, setCurrentZoom] = useState(mapZoom);
  const [currentCenter, setCurrentCenter] = useState(() => ({
    latitude: mapCenterLatitude,
    longitude: mapCenterLongitude,
  }));
  const [isFullscreen, setIsFullscreen] = useState(false);
  const currentCenterRef = useRef(currentCenter);
  const currentZoomRef = useRef(currentZoom);
  const dragStartWorldRef = useRef<{ x: number; y: number } | null>(null);
  const suppressPinPressRef = useRef(false);

  useEffect(() => {
    setCurrentCenter({ latitude: mapCenterLatitude, longitude: mapCenterLongitude });
    setCurrentZoom(mapZoom);
  }, [mapCenterLatitude, mapCenterLongitude, mapZoom]);

  useEffect(() => {
    currentCenterRef.current = currentCenter;
  }, [currentCenter]);

  useEffect(() => {
    currentZoomRef.current = currentZoom;
  }, [currentZoom]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onStartShouldSetPanResponderCapture: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => (
      enablePan && (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4)
    ),
    onMoveShouldSetPanResponderCapture: (_event, gesture) => (
      enablePan && (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4)
    ),
    onPanResponderGrant: () => {
      const center = currentCenterRef.current;
      if (typeof center.latitude !== 'number' || typeof center.longitude !== 'number') return;
      dragStartWorldRef.current = {
        x: lonToWorldX(center.longitude, currentZoomRef.current),
        y: latToWorldY(center.latitude, currentZoomRef.current),
      };
    },
    onPanResponderMove: (_event, gesture) => {
      if (!dragStartWorldRef.current) return;
      if (Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4) {
        suppressPinPressRef.current = true;
      }
      const nextWorld = {
        x: dragStartWorldRef.current.x - gesture.dx,
        y: dragStartWorldRef.current.y - gesture.dy,
      };
      setCurrentCenter(clampCenter(worldToLatLon(nextWorld.x, nextWorld.y, currentZoomRef.current), mapBounds));
    },
    onPanResponderRelease: () => {
      dragStartWorldRef.current = null;
      globalThis.setTimeout(() => {
        suppressPinPressRef.current = false;
      }, 120);
    },
    onPanResponderTerminate: () => {
      dragStartWorldRef.current = null;
      globalThis.setTimeout(() => {
        suppressPinPressRef.current = false;
      }, 120);
    },
  }), [enablePan, mapBounds]);

  const resetMapView = () => {
    setCurrentCenter({ latitude: mapCenterLatitude, longitude: mapCenterLongitude });
    setCurrentZoom(mapZoom);
  };

  const handleWheelZoom = (event: { preventDefault?: () => void; stopPropagation?: () => void; deltaY?: number }) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    const deltaY = event.deltaY ?? 0;
    if (deltaY === 0) return;
    setCurrentZoom((zoom) => Math.max(minZoom, Math.min(maxZoom, zoom + (deltaY < 0 ? 1 : -1))));
  };

  const mapSurface = (height: number, fullscreen = false) => {
    const surfaceKey = fullscreen ? 'fullscreen' : 'inline';
    const surfaceWidth = mapWidths[surfaceKey];
    const pinSpreadOffsets = buildPinSpreadOffsets(mapPins);

    return (
    <MapSurfaceFrame
      height={height}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        setMapWidths((current) => (
          Math.abs(current[surfaceKey] - nextWidth) > 1
            ? { ...current, [surfaceKey]: nextWidth }
            : current
        ));
      }}
      onWheel={handleWheelZoom}
      onHoverChange={onMapHoverChange}
      panHandlers={enablePan ? panResponder.panHandlers : undefined}
    >
      {(() => {
        const surfaceTiles = buildTileLayout(currentCenter.latitude, currentCenter.longitude, currentZoom, surfaceWidth, height);
        const hasSurfaceMap = surfaceTiles.length > 0;

        return hasSurfaceMap ? (
          <View style={styles.tileLayer}>
            {surfaceTiles.map((tile) => (
            <Image
              key={`${tile.z}-${tile.x}-${tile.y}`}
              source={{ uri: `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png` }}
              style={[styles.mapTile, { left: tile.left, top: tile.top }]}
              contentFit="cover"
              pointerEvents="none"
            />
          ))}
          </View>
        ) : mapImageUri ? (
          <Image source={{ uri: mapImageUri }} style={styles.mapImage} contentFit="cover" />
        ) : (
          <View style={styles.mapPlaceholder} />
        );
      })()}

      {mapPolygons.length > 0
        && typeof currentCenter.latitude === 'number'
        && typeof currentCenter.longitude === 'number'
        && surfaceWidth > 0 ? (
          <Svg style={styles.polygonLayer} width={surfaceWidth} height={height}>
            {mapPolygons.map((polygon) => (
              <Path
                key={polygon.id}
                d={multiPolygonToPath(
                  polygon.geometry.coordinates,
                  currentCenter.latitude as number,
                  currentCenter.longitude as number,
                  currentZoom,
                  surfaceWidth,
                  height,
                )}
                fill={polygon.fillColor ?? 'rgba(0, 3, 184, 0.08)'}
                stroke={polygon.strokeColor ?? 'rgba(0, 3, 184, 0.5)'}
                strokeWidth={polygon.strokeWidth ?? 1.5}
                onPress={polygon.onPress}
              />
            ))}
          </Svg>
        ) : null}

      {showOverlayPanel && !fullscreen ? (
        <View style={styles.overlayPanel}>
          <View style={styles.overlayHeader}>
            <Text style={styles.overlayTitle}>{overlayTitle || title}</Text>
            {overlayBadgeLabel ? (
              <View style={styles.overlayBadge}>
                <Text style={styles.overlayBadgeText}>{overlayBadgeLabel}</Text>
              </View>
            ) : null}
          </View>
          {overlayItems?.map((item, index) => (
            <View key={index} style={styles.overlayItem}>
              <View style={[styles.overlayDot, { backgroundColor: item.color || '#0003B8' }]} />
              <Text style={styles.overlayLabel}>{item.label}</Text>
              <Text style={styles.overlayValue}>{item.value}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {typeof surveillanceRadiusKm === 'number'
        && typeof mapCenterLatitude === 'number'
        && typeof mapCenterLongitude === 'number'
        && typeof currentCenter.latitude === 'number'
        && typeof currentCenter.longitude === 'number'
        ? (
          <View
            pointerEvents="none"
            style={[
              styles.radiusCircle,
              radiusCircleStyle(
                surveillanceRadiusKm,
                mapCenterLatitude,
                mapCenterLongitude,
                currentCenter.latitude,
                currentCenter.longitude,
                currentZoom,
                surfaceWidth,
                height,
              ),
            ]}
          />
        ) : null}

      {mapPins.map((pin, index) => {
        const key = pin.id ?? index;
        const projected = typeof currentCenter.latitude === 'number'
          && typeof currentCenter.longitude === 'number'
          && typeof pin.latitude === 'number'
          && typeof pin.longitude === 'number'
          ? projectPin(pin.latitude, pin.longitude, currentCenter.latitude, currentCenter.longitude, currentZoom, surfaceWidth, height)
          : null;
        const spreadOffset = projected ? pinSpreadOffsets.get(index) : undefined;
        const pinPosition = projected
          ? {
            top: projected.top + (spreadOffset?.y ?? 0),
            left: projected.left + (spreadOffset?.x ?? 0),
          }
          : { top: pin.top as never, left: pin.left as never };
        if (projected && (
          projected.left < -48
          || projected.left > surfaceWidth + 48
          || projected.top < -48
          || projected.top > height + 48
        )) {
          return null;
        }
        const pinNode = (
          <View
            style={[
              styles.pin,
              {
                borderColor: pin.borderColor,
                backgroundColor: pin.fillColor || '#FFFFFF',
              },
            ]}
          >
            {pin.icon}
            {pin.label ? <Text style={[styles.pinLabel, { color: pin.borderColor }]}>{pin.label}</Text> : null}
          </View>
        );

        return (
          <View
            key={key}
            style={[styles.pinWrap, pinPosition]}
          >
            {pin.onPress ? (
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => {
                  if (suppressPinPressRef.current) return;
                  pin.onPress?.();
                }}
              >
                {pinNode}
              </TouchableOpacity>
            ) : (
              pinNode
            )}
          </View>
        );
      })}

      {showControls ? (
        <View style={styles.controlsContainer}>
          <MapControlButton icon="plus" style={styles.controlButton} onPress={() => setCurrentZoom((zoom) => Math.min(maxZoom, zoom + 1))} />
          <MapControlButton icon="minus" style={styles.controlButton} onPress={() => setCurrentZoom((zoom) => Math.max(minZoom, zoom - 1))} />
          <MapControlButton icon="settings" style={styles.controlButton} onPress={resetMapView} />
        </View>
      ) : null}

      {bottomRightActionLabel ? (
        <TouchableOpacity
          style={styles.expandButton}
          activeOpacity={0.8}
          onPress={onBottomRightActionPress ?? (() => setIsFullscreen(true))}
        >
          <Feather name="maximize-2" size={14} color="#0003B8" />
          <Text style={styles.expandButtonText}>{bottomRightActionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </MapSurfaceFrame>
  );
  };

  return (
    <View style={[styles.card, style]}>
      {showHeader ? (
        <View style={styles.header}>
          <View style={styles.headerTitleRow}>
            <Feather name="map" size={18} color="#0003B8" />
            <Text style={styles.headerTitle}>{title}</Text>
          </View>

          {legendItems && legendItems.length > 0 ? (
            <MapLegend items={legendItems} orientation="horizontal" />
          ) : null}
        </View>
      ) : null}

      {mapSurface(mapHeight)}

      {showFooter ? (
        <View style={styles.footer}>
          {legendItems && legendItems.length > 0 && !showHeader ? (
            <MapLegend items={legendItems} orientation="horizontal" style={styles.footerLegend} />
          ) : (
            <Text style={styles.footerText}>{footerTextLeft}</Text>
          )}
          <Text style={styles.footerText}>{footerTextRight}</Text>
        </View>
      ) : null}

      <Modal visible={isFullscreen} transparent animationType="fade" onRequestClose={() => setIsFullscreen(false)}>
        <View style={styles.fullscreenOverlay}>
          <Pressable style={styles.fullscreenBackdrop} onPress={() => setIsFullscreen(false)} />
          <View style={styles.fullscreenCard}>
            <View style={styles.fullscreenHeader}>
              <View style={styles.headerTitleRow}>
                <Feather name="map" size={18} color="#0003B8" />
                <Text style={styles.headerTitle}>{title}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={() => setIsFullscreen(false)} activeOpacity={0.75}>
                <Feather name="x" size={18} color="#64748B" />
              </TouchableOpacity>
            </View>
            {mapSurface(720, true)}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MapSurfaceFrame({
  children,
  height,
  onLayout,
  onWheel,
  onHoverChange,
  panHandlers,
}: {
  children: React.ReactNode;
  height: number;
  onLayout: (event: LayoutChangeEvent) => void;
  onWheel: (event: { preventDefault?: () => void; stopPropagation?: () => void; deltaY?: number }) => void;
  onHoverChange?: (isHovering: boolean) => void;
  panHandlers?: object;
}) {
  return (
    <View
      style={[styles.mapContainer, { height }]}
      onLayout={onLayout}
      {...(panHandlers ?? {})}
      {...({
        onWheel,
        onMouseEnter: () => onHoverChange?.(true),
        onMouseLeave: () => onHoverChange?.(false),
      } as object)}
    >
      {children}
    </View>
  );
}

const TILE_SIZE = 256;

function lonToWorldX(longitude: number, zoom: number): number {
  return ((longitude + 180) / 360) * TILE_SIZE * 2 ** zoom;
}

function latToWorldY(latitude: number, zoom: number): number {
  const latRadians = latitude * Math.PI / 180;
  return (
    (1 - Math.log(Math.tan(latRadians) + 1 / Math.cos(latRadians)) / Math.PI) / 2
  ) * TILE_SIZE * 2 ** zoom;
}

function worldToLatLon(x: number, y: number, zoom: number) {
  const worldSize = TILE_SIZE * 2 ** zoom;
  const longitude = (x / worldSize) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / worldSize;
  const latitude = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  return { latitude, longitude };
}

function buildTileLayout(
  latitude: number | undefined,
  longitude: number | undefined,
  zoom: number,
  width: number,
  height: number,
) {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || width <= 0 || height <= 0) {
    return [];
  }

  const worldSize = TILE_SIZE * 2 ** zoom;
  const centerX = lonToWorldX(longitude, zoom);
  const centerY = latToWorldY(latitude, zoom);
  const originX = centerX - width / 2;
  const originY = centerY - height / 2;
  const startX = Math.floor(originX / TILE_SIZE);
  const endX = Math.floor((originX + width) / TILE_SIZE);
  const startY = Math.floor(originY / TILE_SIZE);
  const endY = Math.floor((originY + height) / TILE_SIZE);
  const maxTile = 2 ** zoom;
  const tiles: { x: number; y: number; z: number; left: number; top: number }[] = [];

  for (let tileX = startX; tileX <= endX; tileX += 1) {
    for (let tileY = startY; tileY <= endY; tileY += 1) {
      if (tileY < 0 || tileY >= maxTile) continue;
      const wrappedX = ((tileX % maxTile) + maxTile) % maxTile;
      tiles.push({
        x: wrappedX,
        y: tileY,
        z: zoom,
        left: tileX * TILE_SIZE - originX,
        top: tileY * TILE_SIZE - originY,
      });
    }
  }

  return tiles;
}

function projectPin(
  latitude: number,
  longitude: number,
  centerLatitude: number,
  centerLongitude: number,
  zoom: number,
  width: number,
  height: number,
) {
  const centerX = lonToWorldX(centerLongitude, zoom);
  const centerY = latToWorldY(centerLatitude, zoom);
  const pinX = lonToWorldX(longitude, zoom);
  const pinY = latToWorldY(latitude, zoom);

  return {
    left: width / 2 + (pinX - centerX) - 16,
    top: height / 2 + (pinY - centerY) - 16,
  };
}

function buildPinSpreadOffsets(pins: RadarMapPin[]) {
  const groups = new Map<string, number[]>();
  pins.forEach((pin, index) => {
    if (typeof pin.latitude !== 'number' || typeof pin.longitude !== 'number') return;
    const key = `${pin.latitude.toFixed(6)}:${pin.longitude.toFixed(6)}`;
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });

  const offsets = new Map<number, { x: number; y: number }>();
  groups.forEach((indexes) => {
    if (indexes.length <= 1) return;
    const radius = indexes.length <= 4 ? 24 : indexes.length <= 6 ? 34 : 42;
    indexes.forEach((pinIndex, groupIndex) => {
      if (indexes.length === 2) {
        offsets.set(pinIndex, { x: groupIndex === 0 ? -14 : 14, y: 0 });
        return;
      }

      const useTwoRings = indexes.length > 8;
      const innerCount = useTwoRings ? Math.min(6, Math.ceil(indexes.length * 0.4)) : indexes.length;
      const ringIndex = useTwoRings && groupIndex >= innerCount ? groupIndex - innerCount : groupIndex;
      const ringCount = useTwoRings && groupIndex >= innerCount ? indexes.length - innerCount : innerCount;
      const ringRadius = useTwoRings && groupIndex >= innerCount ? radius + 20 : radius;
      const angleOffset = useTwoRings && groupIndex >= innerCount ? Math.PI / ringCount : 0;
      const angle = (Math.PI * 2 * ringIndex) / ringCount - Math.PI / 2 + angleOffset;
      offsets.set(pinIndex, {
        x: Math.cos(angle) * ringRadius,
        y: Math.sin(angle) * ringRadius,
      });
    });
  });

  return offsets;
}

function projectCoordinate(
  latitude: number,
  longitude: number,
  centerLatitude: number,
  centerLongitude: number,
  zoom: number,
  width: number,
  height: number,
) {
  const centerX = lonToWorldX(centerLongitude, zoom);
  const centerY = latToWorldY(centerLatitude, zoom);
  const pointX = lonToWorldX(longitude, zoom);
  const pointY = latToWorldY(latitude, zoom);

  return {
    x: width / 2 + (pointX - centerX),
    y: height / 2 + (pointY - centerY),
  };
}

function multiPolygonToPath(
  coordinates: number[][][][],
  centerLatitude: number,
  centerLongitude: number,
  zoom: number,
  width: number,
  height: number,
) {
  return coordinates.map((polygon) => (
    polygon.map((ring) => (
      ring.map(([longitude, latitude], index) => {
        const point = projectCoordinate(latitude, longitude, centerLatitude, centerLongitude, zoom, width, height);
        return `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`;
      }).join(' ') + ' Z'
    )).join(' ')
  )).join(' ');
}

function clampCenter(
  center: { latitude: number; longitude: number },
  bounds?: { minLatitude: number; maxLatitude: number; minLongitude: number; maxLongitude: number },
) {
  if (!bounds) return center;
  return {
    latitude: Math.max(bounds.minLatitude, Math.min(bounds.maxLatitude, center.latitude)),
    longitude: Math.max(bounds.minLongitude, Math.min(bounds.maxLongitude, center.longitude)),
  };
}

function radiusCircleStyle(
  radiusKm: number,
  latitude: number,
  longitude: number,
  centerLatitude: number,
  centerLongitude: number,
  zoom: number,
  width: number,
  height: number,
) {
  const center = projectPin(latitude, longitude, centerLatitude, centerLongitude, zoom, width, height);
  const metersPerPixel = (156543.03392 * Math.cos(latitude * Math.PI / 180)) / 2 ** zoom;
  const radiusPixels = (radiusKm * 1000) / metersPerPixel;
  const diameter = Math.max(8, radiusPixels * 2);

  return {
    width: diameter,
    height: diameter,
    borderRadius: diameter / 2,
    left: center.left + 16 - radiusPixels,
    top: center.top + 16 - radiusPixels,
  };
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#FCFDFE',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 3, 184, 0.05)',
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 3,
  },
  header: {
    minHeight: 66,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    paddingHorizontal: 20,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  mapContainer: {
    position: 'relative',
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    cursor: 'grab' as never,
    userSelect: 'none' as never,
  },
  mapImage: {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    opacity: 0.78,
  },
  mapPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#DCE7F3',
  },
  tileLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#E2E8F0',
    pointerEvents: 'none',
  },
  mapTile: {
    position: 'absolute',
    width: TILE_SIZE,
    height: TILE_SIZE,
  },
  overlayPanel: {
    position: 'absolute',
    top: 24,
    left: 24,
    width: 214,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 14,
    padding: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
    zIndex: 6,
  },
  polygonLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  overlayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  overlayTitle: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: '#64748B',
  },
  overlayBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  overlayBadgeText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: '700',
    color: '#16A34A',
  },
  overlayItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  overlayDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    marginRight: 8,
  },
  overlayLabel: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: '#334155',
  },
  overlayValue: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  pinWrap: {
    position: 'absolute',
    zIndex: 4,
  },
  radiusCircle: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: 'rgba(0, 3, 184, 0.32)',
    backgroundColor: 'rgba(0, 3, 184, 0.07)',
    zIndex: 2,
  },
  pin: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
    flexDirection: 'row',
    gap: 6,
  },
  pinLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  controlsContainer: {
    position: 'absolute',
    right: 18,
    bottom: 16,
    gap: 10,
    zIndex: 8,
  },
  expandButton: {
    position: 'absolute',
    right: 72,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 3, 184, 0.12)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
    zIndex: 8,
  },
  expandButtonText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
    color: '#0003B8',
  },
  controlButton: {
    width: 40,
    minWidth: 40,
    minHeight: 40,
    borderWidth: 0,
    borderRadius: 10,
    paddingHorizontal: 0,
    paddingVertical: 0,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  footer: {
    minHeight: 38,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 18,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
  },
  footerLegend: {
    flex: 1,
  },
  footerText: {
    fontSize: 10,
    lineHeight: 14,
    color: '#64748B',
  },
  fullscreenOverlay: {
    flex: 1,
    padding: 28,
    justifyContent: 'center',
  },
  fullscreenBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.36)',
  },
  fullscreenCard: {
    flex: 1,
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.16,
    shadowRadius: 34,
    elevation: 6,
  },
  fullscreenHeader: {
    minHeight: 64,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
});
