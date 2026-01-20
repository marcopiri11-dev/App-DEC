import React from 'react';
import { Student } from '../types';
import { User, Car, Clock } from 'lucide-react';

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
        p-4 rounded-xl border cursor-pointer transition-all duration-200
        ${isSelected 
          ? 'bg-blue-50 border-blue-500 shadow-md transform scale-[1.02]' 
          : 'bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm'}
      `}
    >
      <div className="flex items-center gap-4">
        <img 
          src={student.avatarUrl} 
          alt={student.name} 
          className="w-12 h-12 rounded-full object-cover bg-gray-200"
        />
        <div className="flex-1">
          <h3 className="font-bold text-gray-800">{student.name}</h3>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
            <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded">
              <Car size={12} /> Patente {student.licenseType}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} /> {student.totalHours} ore
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};