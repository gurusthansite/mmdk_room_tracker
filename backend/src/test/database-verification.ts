import { prisma } from '../config/prisma';
import { encryptSensitiveData, decryptSensitiveData, formatMaskedAadhaar } from '../utils/encryption';
import { AllocationStatus, AllocationItemStatus, RegistrationStatus, StayStatus, Gender, ParticipantStatus, UnitType, UnitStatus } from '@prisma/client';

async function runDatabaseVerification() {
  console.log('====================================================');
  console.log('   PHASE 2.1: DATABASE HARDENING VERIFICATION');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function assert(condition: boolean, message: string) {
    totalTests++;
    if (condition) {
      console.log(`[PASS] Test ${totalTests}: ${message}`);
      passedTests++;
    } else {
      console.error(`[FAIL] Test ${totalTests}: ${message}`);
      process.exitCode = 1;
    }
  }

  try {
    // ------------------------------------------------------------------------
    // SECTION 1: Entity Query Verification
    // ------------------------------------------------------------------------
    console.log('--- Subsystem 1: Entity Query Verification ---');
    const adminCount = await prisma.adminUser.count();
    const roomCount = await prisma.room.count();
    const unitCount = await prisma.accommodationUnit.count();
    const regCount = await prisma.registration.count();
    const participantCount = await prisma.participant.count();
    const allocationCount = await prisma.allocation.count();
    const itemCount = await prisma.allocationItem.count();
    const stayCount = await prisma.stayRecord.count();

    assert(adminCount >= 1, `Admin users exist (${adminCount} found)`);
    assert(roomCount >= 5, `Sample rooms exist (${roomCount} found)`);
    assert(unitCount >= 35, `Accommodation units exist (${unitCount} found)`);
    assert(regCount >= 5, `Sample registrations exist (${regCount} found)`);
    assert(participantCount >= 10, `Sample participants exist (${participantCount} found)`);
    assert(allocationCount >= 3, `Sample allocations exist (${allocationCount} found)`);
    assert(itemCount >= 7, `Sample allocation items exist (${itemCount} found)`);
    assert(stayCount >= 1, `Sample stay records exist (${stayCount} found)`);

    // ------------------------------------------------------------------------
    // SECTION 2: Unique Constraints
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 2: Unique Constraint Verifications ---');
    let roomUniqueFailed = false;
    try {
      await prisma.room.create({
        data: {
          roomNumber: 'R-101', // Already exists in seed
          totalBeds: 2,
          totalMats: 0,
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') roomUniqueFailed = true;
    }
    assert(roomUniqueFailed, 'Duplicate roomNumber rejection (Prisma P2002)');

    const r101 = await prisma.room.findFirstOrThrow({ where: { roomNumber: 'R-101' } });
    let unitUniqueFailed = false;
    try {
      await prisma.accommodationUnit.create({
        data: {
          roomId: r101.id,
          unitNumber: 'B1', // Already exists in R-101
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') unitUniqueFailed = true;
    }
    assert(unitUniqueFailed, 'Duplicate unitNumber in same room rejection (Prisma P2002)');

    let regUniqueFailed = false;
    try {
      await prisma.registration.create({
        data: {
          registrationId: 'REG-0001', // Already exists
          primaryName: 'Duplicate Test',
          mobile: '9000000000',
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') regUniqueFailed = true;
    }
    assert(regUniqueFailed, 'Duplicate registrationId rejection (Prisma P2002)');

    // ------------------------------------------------------------------------
    // SECTION 3: Database-Level Allocation Conflict Protection & Concurrency
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 3: Database-Level Conflict Protection & Concurrency ---');
    const admin = await prisma.adminUser.findFirstOrThrow();
    const testReg = await prisma.registration.create({
      data: {
        registrationId: `REG-CONFLICT-TEST-${Date.now()}`,
        primaryName: 'Concurrency Tester',
        mobile: '9999900001',
      },
    });

    const testUnit = await prisma.accommodationUnit.findFirstOrThrow({
      where: { roomId: r101.id, unitNumber: 'M2' }, // Use Mat 2 in R-101
    });

    // Clean up any test items on M2
    await prisma.allocationItem.deleteMany({ where: { unitId: testUnit.id } });

    // Step A: Base active allocation: Nov 10 to Nov 15, 2026
    const alcA = await prisma.allocation.create({
      data: {
        allocationNumber: `ALC-TEST-A-${Date.now()}`,
        registrationId: testReg.id,
        entryDate: new Date('2026-11-10T00:00:00.000Z'),
        exitDate: new Date('2026-11-15T00:00:00.000Z'),
        status: AllocationStatus.TENTATIVE,
        createdById: admin.id,
      },
    });

    await prisma.allocationItem.create({
      data: {
        allocationId: alcA.id,
        unitId: testUnit.id,
        entryDate: new Date('2026-11-10T00:00:00.000Z'),
        exitDate: new Date('2026-11-15T00:00:00.000Z'),
        status: AllocationItemStatus.TENTATIVE,
      },
    });
    assert(true, 'Baseline tentative allocation created on Unit R-101:M2 (Nov 10 to Nov 15)');

    // Step B: Database-level exclusion constraint rejection on overlapping dates (Nov 12 to Nov 17)
    let pgExclusionFailed = false;
    const alcB = await prisma.allocation.create({
      data: {
        allocationNumber: `ALC-TEST-B-${Date.now()}`,
        registrationId: testReg.id,
        entryDate: new Date('2026-11-12T00:00:00.000Z'),
        exitDate: new Date('2026-11-17T00:00:00.000Z'),
        status: AllocationStatus.TENTATIVE,
        createdById: admin.id,
      },
    });

    try {
      await prisma.allocationItem.create({
        data: {
          allocationId: alcB.id,
          unitId: testUnit.id,
          entryDate: new Date('2026-11-12T00:00:00.000Z'),
          exitDate: new Date('2026-11-17T00:00:00.000Z'),
          status: AllocationItemStatus.TENTATIVE,
        },
      });
    } catch (err: any) {
      // PostgreSQL error 23P01 (exclusion_violation)
      if (err.message.includes('no_overlapping_active_allocations') || err.message.includes('exclusion')) {
        pgExclusionFailed = true;
      }
    }
    assert(pgExclusionFailed, 'PostgreSQL exclusion constraint rejected overlapping allocation interval (23P01)');

    // Step C: Concurrency test - Two simultaneous async requests trying to allocate Unit R-101:M2
    console.log('Testing simultaneous concurrent allocation attempts...');
    const alcC1 = await prisma.allocation.create({
      data: {
        allocationNumber: `ALC-CONCUR-1-${Date.now()}`,
        registrationId: testReg.id,
        entryDate: new Date('2026-11-20T00:00:00.000Z'),
        exitDate: new Date('2026-11-25T00:00:00.000Z'),
        createdById: admin.id,
      },
    });
    const alcC2 = await prisma.allocation.create({
      data: {
        allocationNumber: `ALC-CONCUR-2-${Date.now()}`,
        registrationId: testReg.id,
        entryDate: new Date('2026-11-22T00:00:00.000Z'),
        exitDate: new Date('2026-11-27T00:00:00.000Z'),
        createdById: admin.id,
      },
    });

    const [res1, res2] = await Promise.allSettled([
      prisma.allocationItem.create({
        data: {
          allocationId: alcC1.id,
          unitId: testUnit.id,
          entryDate: new Date('2026-11-20T00:00:00.000Z'),
          exitDate: new Date('2026-11-25T00:00:00.000Z'),
          status: AllocationItemStatus.TENTATIVE,
        },
      }),
      prisma.allocationItem.create({
        data: {
          allocationId: alcC2.id,
          unitId: testUnit.id,
          entryDate: new Date('2026-11-22T00:00:00.000Z'),
          exitDate: new Date('2026-11-27T00:00:00.000Z'),
          status: AllocationItemStatus.TENTATIVE,
        },
      }),
    ]);

    const oneSucceeded = (res1.status === 'fulfilled' && res2.status === 'rejected') || (res2.status === 'fulfilled' && res1.status === 'rejected');
    assert(oneSucceeded, 'Concurrent allocation race test: Exactly one succeeded, competing attempt rejected at DB level');

    // Step D: Cancelled allocations appropriately excluded from conflict
    // If we cancel the winning concurrent allocation, a new allocation for that window must succeed
    const winningAlc = res1.status === 'fulfilled' ? alcC1 : alcC2;
    await prisma.allocationItem.updateMany({
      where: { allocationId: winningAlc.id },
      data: { status: AllocationItemStatus.CANCELLED },
    });

    const alcReuse = await prisma.allocation.create({
      data: {
        allocationNumber: `ALC-REUSE-${Date.now()}`,
        registrationId: testReg.id,
        entryDate: new Date('2026-11-20T00:00:00.000Z'),
        exitDate: new Date('2026-11-25T00:00:00.000Z'),
        createdById: admin.id,
      },
    });
    const reuseItem = await prisma.allocationItem.create({
      data: {
        allocationId: alcReuse.id,
        unitId: testUnit.id,
        entryDate: new Date('2026-11-20T00:00:00.000Z'),
        exitDate: new Date('2026-11-25T00:00:00.000Z'),
        status: AllocationItemStatus.TENTATIVE,
      },
    });
    assert(reuseItem !== null, 'Cancelled allocations excluded: Bed/Mat became available once prior allocation cancelled');

    // ------------------------------------------------------------------------
    // SECTION 4: Participant Gender Flexibility
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 4: Participant Gender Flexibility ---');
    const unknownGenderParticipant = await prisma.participant.create({
      data: {
        registrationId: testReg.id,
        fullName: 'Gender Flexibility Test Guest',
        gender: null, // Unknown at registration
      },
    });
    assert(unknownGenderParticipant.gender === null, 'Participant created with null gender (not forced to MALE)');

    // Update at reception
    const updatedGuest = await prisma.participant.update({
      where: { id: unknownGenderParticipant.id },
      data: { gender: Gender.FEMALE, age: 31 },
    });
    assert(updatedGuest.gender === Gender.FEMALE && updatedGuest.age === 31, 'Participant gender updated to FEMALE upon reception arrival');

    // ------------------------------------------------------------------------
    // SECTION 5: Inventory Consistency & Automated Trigger Sync
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 5: Inventory Capacity Trigger Synchronization ---');
    const testRoom = await prisma.room.create({
      data: {
        roomNumber: `R-TRIG-TEST-${Date.now()}`,
        totalBeds: 0,
        totalMats: 0,
      },
    });

    // Insert 2 beds and 1 mat into testRoom
    await prisma.accommodationUnit.create({
      data: { roomId: testRoom.id, unitNumber: 'B1', type: UnitType.BED, status: UnitStatus.ACTIVE },
    });
    await prisma.accommodationUnit.create({
      data: { roomId: testRoom.id, unitNumber: 'B2', type: UnitType.BED, status: UnitStatus.ACTIVE },
    });
    await prisma.accommodationUnit.create({
      data: { roomId: testRoom.id, unitNumber: 'M1', type: UnitType.MAT, status: UnitStatus.ACTIVE },
    });

    const roomAfterInsert = await prisma.room.findUniqueOrThrow({ where: { id: testRoom.id } });
    assert(
      roomAfterInsert.totalBeds === 2 && roomAfterInsert.totalMats === 1,
      `Database trigger synchronized capacity: totalBeds=2, totalMats=1 (Actual units: 2 beds, 1 mat)`
    );

    // Deleting 1 bed unit updates the room capacity automatically
    const unitToDelete = await prisma.accommodationUnit.findFirstOrThrow({
      where: { roomId: testRoom.id, unitNumber: 'B2' },
    });
    await prisma.accommodationUnit.delete({ where: { id: unitToDelete.id } });

    const roomAfterDelete = await prisma.room.findUniqueOrThrow({ where: { id: testRoom.id } });
    assert(
      roomAfterDelete.totalBeds === 1 && roomAfterDelete.totalMats === 1,
      `Database trigger synchronized upon unit deletion: totalBeds=1, totalMats=1`
    );

    // ------------------------------------------------------------------------
    // SECTION 6: Historical Record Preservation (Restrict Constraints & Archival)
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 6: Preservation of Historical Operational Records ---');
    let deletePrevented = false;
    try {
      // testReg has allocations and participants; attempting hard delete must fail due to Restrict FK
      await prisma.registration.delete({ where: { id: testReg.id } });
    } catch (err: any) {
      if (err.code === 'P2003' || err.message.includes('RESTRICT') || err.message.includes('foreign key')) {
        deletePrevented = true;
      }
    }
    assert(deletePrevented, 'Destructive cascade blocked: Registration delete rejected by Restrict constraint (code 23001/P2003)');

    // Soft deletion / archival safeguard works properly
    const archivedReg = await prisma.registration.update({
      where: { id: testReg.id },
      data: {
        isArchived: true,
        deletedAt: new Date(),
        status: RegistrationStatus.CANCELLED,
      },
    });
    assert(archivedReg.isArchived === true && archivedReg.deletedAt !== null, 'Soft-deletion / archival preserved registration and all linked history');

    // ------------------------------------------------------------------------
    // SECTION 7: Reception Participant-to-Unit Mapping & Transfers
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 7: Reception Participant-to-Unit Mapping & Overlap Prevention ---');
    const pArrival1 = await prisma.participant.create({
      data: { registrationId: testReg.id, fullName: 'Family Member 1', gender: Gender.MALE },
    });
    const pArrival2 = await prisma.participant.create({
      data: { registrationId: testReg.id, fullName: 'Family Member 2', gender: Gender.FEMALE },
    });

    const unitStay = await prisma.accommodationUnit.findFirstOrThrow({
      where: { roomId: r101.id, unitNumber: 'B3' },
    });

    // Clean any prior stays on B3
    await prisma.stayRecord.deleteMany({ where: { unitId: unitStay.id } });

    // Step A: Member 1 checks in to Unit B3
    const stay1 = await prisma.stayRecord.create({
      data: {
        registrationId: testReg.id,
        participantId: pArrival1.id,
        unitId: unitStay.id,
        status: StayStatus.CHECKED_IN,
        actualCheckIn: new Date('2026-11-01T10:00:00.000Z'),
        recordedById: admin.id,
      },
    });
    assert(stay1 !== null, 'Participant 1 mapped to Unit R-101:B3 with CHECKED_IN status');

    // Step B: Attempting to check in Member 2 into the SAME physical unit concurrently is rejected by DB exclusion constraint
    let stayOverlapRejected = false;
    try {
      await prisma.stayRecord.create({
        data: {
          registrationId: testReg.id,
          participantId: pArrival2.id,
          unitId: unitStay.id,
          status: StayStatus.CHECKED_IN,
          actualCheckIn: new Date('2026-11-01T12:00:00.000Z'), // Overlapping active stay
          recordedById: admin.id,
        },
      });
    } catch (err: any) {
      if (err.message.includes('no_overlapping_active_stays') || err.message.includes('exclusion')) {
        stayOverlapRejected = true;
      }
    }
    assert(stayOverlapRejected, 'PostgreSQL exclusion constraint rejected double active occupancy on Unit R-101:B3');

    // Step C: Room Transfer / Reassignment workflow
    // Member 1 transfers from B3 to Unit B4 in R-101
    const targetUnit = await prisma.accommodationUnit.findFirstOrThrow({
      where: { roomId: r101.id, unitNumber: 'B4' },
    });
    await prisma.stayRecord.deleteMany({ where: { unitId: targetUnit.id } });

    // Update prior stay to TRANSFERRED with checkout time
    const transferredStay = await prisma.stayRecord.update({
      where: { id: stay1.id },
      data: {
        status: StayStatus.TRANSFERRED,
        actualCheckOut: new Date('2026-11-02T10:00:00.000Z'),
        transferReason: 'Transferred to lower bed requested by participant',
      },
    });

    // Create subsequent stay record linked via previousStayRecordId
    const newStay = await prisma.stayRecord.create({
      data: {
        registrationId: testReg.id,
        participantId: pArrival1.id,
        unitId: targetUnit.id,
        previousStayRecordId: transferredStay.id,
        status: StayStatus.CHECKED_IN,
        actualCheckIn: new Date('2026-11-02T10:00:00.000Z'),
        transferReason: 'Transferred to lower bed requested by participant',
        recordedById: admin.id,
      },
    });

    assert(
      newStay.previousStayRecordId === stay1.id && transferredStay.status === StayStatus.TRANSFERRED,
      'Transfer history preserved: Linked prior stay record via previousStayRecordId and recorded reason'
    );

    // ------------------------------------------------------------------------
    // SECTION 8: Aadhaar Safeguards & Opt-in Retention
    // ------------------------------------------------------------------------
    console.log('\n--- Subsystem 8: Aadhaar Compliance & Security Safeguards ---');
    const aadhaarPlain = '888877776666';
    const encrypted = encryptSensitiveData(aadhaarPlain);

    // Verify default retentionConsent is false (explicit opt-in)
    const aadhaarRecord = await prisma.aadhaarRecord.create({
      data: {
        participantId: pArrival1.id,
        encryptedAadhaar: encrypted.encryptedText,
        aadhaarIv: encrypted.iv,
        aadhaarAuthTag: encrypted.authTag,
        lastFourDigits: encrypted.lastFourDigits,
        recordedById: admin.id,
        // retentionConsent left to default
      },
    });

    assert(aadhaarRecord.retentionConsent === false, 'Aadhaar consent requirement satisfied: retentionConsent defaults to FALSE');
    assert(aadhaarRecord.lastFourDigits === '6666', 'Last 4 digits stored unencrypted for verification (6666)');
    
    const decrypted = decryptSensitiveData(aadhaarRecord.encryptedAadhaar, aadhaarRecord.aadhaarIv, aadhaarRecord.aadhaarAuthTag);
    assert(decrypted === aadhaarPlain, 'AES-256-GCM decryption successfully verified');

    const maskedUI = formatMaskedAadhaar(aadhaarRecord.lastFourDigits);
    assert(maskedUI === 'XXXX-XXXX-6666', 'UI masked format renders compliant output (XXXX-XXXX-6666)');

    // ------------------------------------------------------------------------
    // CLEANUP TEST OBJECTS
    // ------------------------------------------------------------------------
    await prisma.aadhaarRecord.deleteMany({ where: { id: aadhaarRecord.id } });
    await prisma.stayRecord.deleteMany({ where: { id: { in: [stay1.id, newStay.id] } } });
    await prisma.participant.deleteMany({ where: { id: { in: [unknownGenderParticipant.id, pArrival1.id, pArrival2.id] } } });
    await prisma.allocationItem.deleteMany({ where: { unitId: testUnit.id } });
    await prisma.allocation.deleteMany({ where: { registrationId: testReg.id } });
    await prisma.registration.delete({ where: { id: testReg.id } });
    await prisma.accommodationUnit.deleteMany({ where: { roomId: testRoom.id } });
    await prisma.room.delete({ where: { id: testRoom.id } });

    // ------------------------------------------------------------------------
    // SUMMARY
    // ------------------------------------------------------------------------
    console.log('\n====================================================');
    console.log(`   PHASE 2.1 VERIFICATION RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
    console.log('====================================================\n');

  } catch (error) {
    console.error('Unexpected error during database verification:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runDatabaseVerification();
