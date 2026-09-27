import type { ProfileId } from "@/types";

/**
 * Custom BRouter profiles (uploaded to the server at runtime) for a light enduro motorcycle.
 * Built-in server profiles are used for hiking and cycling.
 */

type Costs = {
  motorway: number;
  trunk: number;
  primary: number;
  secondary: number;
  tertiary: number;
  unclassified: number;
  unclassifiedUnpaved: number;
  residential: number;
  service: number;
  trackPaved: number;
  grade1: number;
  grade2: number;
  grade3: number;
  grade4: number;
  grade5: number;
  trackUnknown: number;
  path: number;
};

const FORBIDDEN = 10000;

const COSTS: Record<"enduro" | "moto_road" | "moto_curvy", Costs> = {
  enduro: {
    motorway: FORBIDDEN,
    trunk: 4,
    primary: 2.2,
    secondary: 1.7,
    tertiary: 1.4,
    unclassified: 1.25,
    unclassifiedUnpaved: 1.0,
    residential: 1.8,
    service: 1.8,
    trackPaved: 1.25,
    grade1: 1.15,
    grade2: 1.0,
    grade3: 1.0,
    grade4: 1.25,
    grade5: 1.8,
    trackUnknown: 1.15,
    path: 2.5,
  },
  moto_road: {
    motorway: 1.0,
    trunk: 1.0,
    primary: 1.05,
    secondary: 1.15,
    tertiary: 1.3,
    unclassified: 1.5,
    unclassifiedUnpaved: 4,
    residential: 2,
    service: 3,
    trackPaved: 5,
    grade1: 6,
    grade2: FORBIDDEN,
    grade3: FORBIDDEN,
    grade4: FORBIDDEN,
    grade5: FORBIDDEN,
    trackUnknown: FORBIDDEN,
    path: FORBIDDEN,
  },
  moto_curvy: {
    motorway: 6,
    trunk: 3,
    primary: 1.6,
    secondary: 1.1,
    tertiary: 1.0,
    unclassified: 1.05,
    unclassifiedUnpaved: 2.5,
    residential: 2.2,
    service: 3,
    trackPaved: 2.5,
    grade1: 3.5,
    grade2: FORBIDDEN,
    grade3: FORBIDDEN,
    grade4: FORBIDDEN,
    grade5: FORBIDDEN,
    trackUnknown: FORBIDDEN,
    path: FORBIDDEN,
  },
};

function build(name: string, c: Costs, respectAccess: boolean): string {
  const accessBlock = respectAccess ? FORBIDDEN : 0;
  return `# Moje Mapy – ${name}
---context:global
assign downhillcost 0
assign downhillcutoff 0
assign uphillcost 0
assign uphillcutoff 0
assign validForBikes 0
assign validForCars 1
assign turnInstructionMode = 1
assign turnInstructionCatchingRange = 40
assign turnInstructionRoundabouts = true

---context:way
assign turncost = if junction=roundabout then 0 else 80
assign initialclassifier = if route=ferry then 1 else 0
assign initialcost = if route=ferry then 20000 else 0

assign isresidentialorliving = or highway=residential|living_street living_street=yes
assign ispaved = surface=paved|asphalt|concrete|paving_stones|sett
assign isunpaved = surface=unpaved|gravel|fine_gravel|compacted|dirt|earth|ground|grass|sand|mud|pebblestone|rock
assign istrack = highway=track
assign ispath = highway=path|bridleway|footway|cycleway|steps|pedestrian

assign defaultaccess =
  if highway=motorway|motorway_link|trunk|trunk_link|primary|primary_link|secondary|secondary_link|tertiary|tertiary_link|unclassified|service|road|track then 1
  else if isresidentialorliving then 1
  else if route=ferry then 1
  else 0

assign motorvehicleaccess =
  if motor_vehicle= then
    ( if vehicle= then
        ( if access= then defaultaccess
          else access=yes|designated|destination|permissive|customers|delivery )
      else vehicle=yes|designated|destination|permissive )
  else motor_vehicle=yes|designated|destination|permissive

assign motorcycleaccess =
  if motorcycle= then motorvehicleaccess
  else motorcycle=yes|designated|destination|permissive

assign accesspenalty = if motorcycleaccess then 0 else ${accessBlock}

assign onewaypenalty =
  if ( if reversedirection=yes then oneway=-1
       else if oneway= then junction=roundabout
       else oneway=yes|true|1 ) then 10000 else 0

assign islinktype = highway=motorway_link|trunk_link|primary_link|secondary_link|tertiary_link

assign roadcost =
  if highway=motorway|motorway_link then ${c.motorway}
  else if highway=trunk|trunk_link then ${c.trunk}
  else if highway=primary|primary_link then ${c.primary}
  else if highway=secondary|secondary_link then ${c.secondary}
  else if highway=tertiary|tertiary_link then ${c.tertiary}
  else if highway=unclassified|road then ( if isunpaved then ${c.unclassifiedUnpaved} else ${c.unclassified} )
  else if isresidentialorliving then ${c.residential}
  else if highway=service then ${c.service}
  else if route=ferry then 5.67
  else if istrack then
    ( if tracktype=grade1 then ${c.grade1}
      else if tracktype=grade2 then ${c.grade2}
      else if tracktype=grade3 then ${c.grade3}
      else if tracktype=grade4 then ${c.grade4}
      else if tracktype=grade5 then ${c.grade5}
      else if ispaved then ${c.trackPaved}
      else ${c.trackUnknown} )
  else if highway=path|bridleway then ${c.path}
  else ${FORBIDDEN}

assign costfactor = add max onewaypenalty accesspenalty add ( if islinktype then 0.05 else 0 ) roadcost

assign priorityclassifier =
  if      ( highway=motorway                  ) then  30
  else if ( highway=motorway_link             ) then  29
  else if ( highway=trunk                     ) then  28
  else if ( highway=trunk_link                ) then  27
  else if ( highway=primary                   ) then  26
  else if ( highway=primary_link              ) then  25
  else if ( highway=secondary                 ) then  24
  else if ( highway=secondary_link            ) then  23
  else if ( highway=tertiary                  ) then  22
  else if ( highway=tertiary_link             ) then  21
  else if ( highway=unclassified              ) then  20
  else if ( isresidentialorliving             ) then  6
  else if ( highway=service                   ) then  6
  else if ( highway=track                     ) then if tracktype=grade1 then 4 else 2
  else if ( highway=bridleway|road|path       ) then  2
  else 0

assign isbadoneway = not equal onewaypenalty 0
assign isgoodoneway = if reversedirection=yes then oneway=-1
                      else if oneway= then junction=roundabout else oneway=yes|true|1
assign isroundabout = junction=roundabout
assign isgoodforcars = if greater priorityclassifier 6 then true
                  else if ( or isresidentialorliving highway=service ) then true
                  else if ( and highway=track tracktype=grade1 ) then true
                  else false

assign classifiermask add          isbadoneway
                      add multiply isgoodoneway   2
                      add multiply isroundabout   4
                      add multiply islinktype     8
                          multiply isgoodforcars 16

assign dummyUsage = or smoothness= maxspeed=

---context:node
assign motorvehicleaccess =
  if motor_vehicle= then
    ( if vehicle= then
        ( if access= then
            ( if barrier=bollard|cycle_barrier|block|kissing_gate|stile|turnstile then 0 else 1 )
          else access=yes|designated|destination|permissive )
      else vehicle=yes|designated|destination|permissive )
  else motor_vehicle=yes|designated|destination|permissive

assign motorcycleaccess =
  if motorcycle= then motorvehicleaccess
  else motorcycle=yes|designated|destination|permissive

assign initialcost =
  if not motorcycleaccess then 1000000
  else if barrier=lift_gate then ${respectAccess ? 1000000 : 3000}
  else if barrier=gate then 600
  else 0
`;
}

export type CustomProfile = keyof typeof COSTS;
export const CUSTOM_PROFILES: CustomProfile[] = ["enduro", "moto_road", "moto_curvy"];

/** Server built-in profile names for non-motorcycle modes. */
export const BUILTIN: Partial<Record<ProfileId, string>> = {
  hike: "hiking-mountain",
  bike: "trekking",
};

export function profileSource(id: CustomProfile, respectAccess: boolean): string {
  return build(id, COSTS[id], respectAccess);
}
