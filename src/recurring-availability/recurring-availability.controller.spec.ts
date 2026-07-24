import { Test, TestingModule } from '@nestjs/testing';
import { RecurringAvailabilityController } from './recurring-availability.controller';
import { RecurringAvailabilityService } from './recurring-availability.service';

describe('RecurringAvailabilityController', () => {
  let controller: RecurringAvailabilityController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecurringAvailabilityController],
      providers: [RecurringAvailabilityService],
    }).compile();

    controller = module.get<RecurringAvailabilityController>(RecurringAvailabilityController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
