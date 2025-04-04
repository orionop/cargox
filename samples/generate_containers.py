import pandas as pd
from random import randint, choice
from sample_data import expanded_items_dict

# Define possible zones and generate unique container IDs
zones = list(set(zone for zone_list in expanded_items_dict.values() for zone in zone_list))

container_data = []
zone_ids = {}

for zone in zones:
    container_id_counter = 1
    zone_id = ''.join([i[0] for i in zone.split('_')])
    n = 0
    while zone_id in zone_ids:
        print(f"Error: repeating zone ids: {zone} and {zone_ids[zone_id]}")
        n+=1
        zone_id = ''.join([i[min(n, len(i)-1)].upper() for i in zone.split('_')])

    zone_ids[zone_id] = zone

    for _ in range(randint(2,5)):
        container_id = f"{zone_id}{container_id_counter:02d}"
        
        # Base dimensions (some reasonable defaults)
        base_width, base_depth, base_height = 100, 85, 200

        # Apply small fractional/multiple variations to dimensions
        width = base_width * choice([1, 2**(randint(-2,1))])
        depth = base_depth * choice([1, 2**(randint(-2,1))])
        height = base_height * choice([1, 2**(randint(-2,1))])

        container_data.append([zone, container_id, width, depth, height])
        container_id_counter += 1

# Create DataFrame and save as CSV
df_containers = pd.DataFrame(container_data, columns=["zone", "container_id", "width_cm", "depth_cm", "height_cm"])

csv_containers_path = "containers.csv"
df_containers.to_csv(csv_containers_path, index=False)
csv_containers_path

