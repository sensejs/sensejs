import {ChildEntity, Column, Entity, PrimaryGeneratedColumn, TableInheritance, Unique} from 'typeorm';

enum DeviceDomain {
  SMOKE,
  ELECTRONIC_FIRE,
  FIRE_HOST,
  CAMERA,
}

@Entity()
class SmokeAlarmMetadata {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
}

@Entity()
class ElectronicFireAlarmMetadata {
  @PrimaryGeneratedColumn('uuid')
  id!: string;
}

@Entity()
@Unique(['deviceDomain', 'deviceSn'])
@TableInheritance({column: {type: 'enum', enum: DeviceDomain, name: 'deviceDomain'}})
class DeviceAlarm {
  @Column('varchar')
  deviceSn!: string;
}

@ChildEntity(DeviceDomain.SMOKE)
class SmokeDeviceAlarm {
  metadata!: SmokeAlarmMetadata;
}

@ChildEntity(DeviceDomain.ELECTRONIC_FIRE)
class ElectronicFireDeviceAlarm {
  metadata!: ElectronicFireAlarmMetadata;
}
