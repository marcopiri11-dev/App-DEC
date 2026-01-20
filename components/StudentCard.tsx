
import React from 'react';
import { Student } from '../types';
import { User, Car, Clock, Phone } from 'lucide-react';

interface StudentCardProps {
  student: Student;
  onClick: () => void;
  isSelected: boolean;
}

export const StudentCard: React.FC<StudentCardProps> = ({ student, onClick, isSelected }) => {
  return (
    <div 
      onClick={onClick}
      className={`
        p-4 rounded-3xl border cursor-pointer transition-all duration-200
        ${isSelected 
          ? 'bg-blue-50 border-blue-500 shadow-md transform scale-[1.02]' 
          : 'bg-white border-gray-100 hover:border-blue-300 hover:shadow-sm shadow-sm'}
      `}
    >
      <div className="flex items-center gap-4">
        <img 
          src={student.avatarUrl} 
          alt={student.name} 
          className="w-14 h-14 rounded-2xl object-cover bg-gray-50 shadow-inner"
        />
        <div className="flex-1">
          <h3 className="font-black text-gray-900 tracking-tight leading-none mb-1">{student.name}</h3>
          <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
            <span className="flex items-center gap-1 bg-gray-100 px-2 py-1 rounded-lg font-bold">
              <Car size={12} /> Patente {student.licenseType}
            </span>
            <span className="flex items-center gap-1 bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-bold">
              <Clock size={12} /> {student.totalHours}h totali
            </span>
            {student.phoneNumber && (
              <span className="flex items-center gap-1 bg-green-50 text-green-600 px-2 py-1 rounded-lg font-bold">
                <Phone size={12} /> {student.phoneNumber}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
